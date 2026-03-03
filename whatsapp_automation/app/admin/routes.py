"""Admin routes for the web interface."""
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Form, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db, get_mongodb
from app.core.security import generate_api_key, hash_api_key
from app.domain.entities.tenant import Tenant
from app.domain.entities.bot_config import BotConfig, TriggerMode

router = APIRouter(prefix="/admin", tags=["admin"])

templates = Jinja2Templates(directory="app/admin/templates")


def flash(request: Request, message: str, category: str = "info"):
    """Simple flash message implementation."""
    if "_messages" not in request.session:
        request.session["_messages"] = []
    request.session["_messages"].append((category, message))


def get_flashed_messages(request: Request):
    """Get and clear flash messages."""
    messages = request.session.pop("_messages", [])
    return messages


# ==================== DASHBOARD ====================

@router.get("/", response_class=HTMLResponse)
async def dashboard(request: Request, db: AsyncSession = Depends(get_db)):
    """Admin dashboard with statistics."""
    # Get tenant stats
    total_tenants = await db.scalar(select(func.count(Tenant.id)))
    active_tenants = await db.scalar(
        select(func.count(Tenant.id)).where(Tenant.is_active == True)
    )
    total_configs = await db.scalar(select(func.count(BotConfig.id)))
    
    # Get message stats from MongoDB
    mongodb = get_mongodb()
    messages_today = 0
    recent_messages = []
    
    if mongodb is not None:
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        messages_today = await mongodb.message_logs.count_documents({
            "created_at": {"$gte": today_start}
        })
        
        cursor = mongodb.message_logs.find().sort("created_at", -1).limit(10)
        recent_messages = await cursor.to_list(length=10)
        
        # Convert to simple objects for template
        recent_messages = [
            type('Message', (), {
                'sender_phone': m.get('sender_phone', ''),
                'message_type': m.get('message_type', 'text'),
                'content': m.get('content', ''),
                'created_at': m.get('created_at')
            })()
            for m in recent_messages
        ]
    
    stats = {
        "total_tenants": total_tenants or 0,
        "active_tenants": active_tenants or 0,
        "total_configs": total_configs or 0,
        "messages_today": messages_today
    }
    
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "stats": stats,
        "recent_messages": recent_messages,
        "get_flashed_messages": lambda: get_flashed_messages(request)
    })


# ==================== TENANTS ====================

@router.get("/tenants", response_class=HTMLResponse)
async def list_tenants(request: Request, db: AsyncSession = Depends(get_db)):
    """List all tenants."""
    result = await db.execute(
        select(Tenant).order_by(Tenant.created_at.desc())
    )
    tenants = result.scalars().all()
    
    return templates.TemplateResponse("tenants/list.html", {
        "request": request,
        "tenants": tenants,
        "get_flashed_messages": lambda: get_flashed_messages(request)
    })


@router.get("/tenants/new", response_class=HTMLResponse)
async def new_tenant_form(request: Request):
    """Show form to create new tenant."""
    return templates.TemplateResponse("tenants/form.html", {
        "request": request,
        "tenant": None,
        "get_flashed_messages": lambda: get_flashed_messages(request)
    })


@router.post("/tenants/new")
async def create_tenant(
    request: Request,
    name: str = Form(...),
    phone_number: str = Form(...),
    is_active: bool = Form(False),
    db: AsyncSession = Depends(get_db)
):
    """Create a new tenant."""
    try:
        # Check if phone already exists
        existing = await db.scalar(
            select(Tenant).where(Tenant.phone_number == phone_number)
        )
        if existing:
            flash(request, f"Telefone {phone_number} já está cadastrado.", "danger")
            return RedirectResponse("/admin/tenants/new", status_code=303)
        
        api_key = generate_api_key()
        tenant = Tenant(
            name=name,
            phone_number=phone_number,
            is_active=is_active if is_active else True,
            api_key=hash_api_key(api_key)
        )
        db.add(tenant)
        await db.commit()
        
        flash(request, f"Tenant criado com sucesso! API Key: {api_key} (guarde em local seguro)", "success")
        return RedirectResponse("/admin/tenants", status_code=303)
    except Exception as e:
        await db.rollback()
        flash(request, f"Erro ao criar tenant: {str(e)}", "danger")
        return RedirectResponse("/admin/tenants/new", status_code=303)


@router.get("/tenants/{tenant_id}/edit", response_class=HTMLResponse)
async def edit_tenant_form(
    request: Request,
    tenant_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Show form to edit tenant."""
    tenant = await db.get(Tenant, UUID(tenant_id))
    if not tenant:
        flash(request, "Tenant não encontrado.", "danger")
        return RedirectResponse("/admin/tenants", status_code=303)
    
    return templates.TemplateResponse("tenants/form.html", {
        "request": request,
        "tenant": tenant,
        "get_flashed_messages": lambda: get_flashed_messages(request)
    })


@router.post("/tenants/{tenant_id}/edit")
async def update_tenant(
    request: Request,
    tenant_id: str,
    name: str = Form(...),
    phone_number: str = Form(...),
    is_active: bool = Form(False),
    db: AsyncSession = Depends(get_db)
):
    """Update a tenant."""
    try:
        tenant = await db.get(Tenant, UUID(tenant_id))
        if not tenant:
            flash(request, "Tenant não encontrado.", "danger")
            return RedirectResponse("/admin/tenants", status_code=303)
        
        tenant.name = name
        tenant.phone_number = phone_number
        tenant.is_active = is_active if is_active else False
        
        await db.commit()
        flash(request, "Tenant atualizado com sucesso!", "success")
        return RedirectResponse("/admin/tenants", status_code=303)
    except Exception as e:
        await db.rollback()
        flash(request, f"Erro ao atualizar tenant: {str(e)}", "danger")
        return RedirectResponse(f"/admin/tenants/{tenant_id}/edit", status_code=303)


@router.post("/tenants/{tenant_id}/delete")
async def delete_tenant(
    request: Request,
    tenant_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a tenant."""
    try:
        tenant = await db.get(Tenant, UUID(tenant_id))
        if tenant:
            await db.delete(tenant)
            await db.commit()
            flash(request, "Tenant excluído com sucesso!", "success")
        else:
            flash(request, "Tenant não encontrado.", "danger")
    except Exception as e:
        await db.rollback()
        flash(request, f"Erro ao excluir tenant: {str(e)}", "danger")
    
    return RedirectResponse("/admin/tenants", status_code=303)


@router.post("/tenants/{tenant_id}/regenerate-key")
async def regenerate_api_key(
    request: Request,
    tenant_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Regenerate API key for a tenant."""
    try:
        tenant = await db.get(Tenant, UUID(tenant_id))
        if not tenant:
            flash(request, "Tenant não encontrado.", "danger")
            return RedirectResponse("/admin/tenants", status_code=303)
        
        new_api_key = generate_api_key()
        tenant.api_key = hash_api_key(new_api_key)
        await db.commit()
        
        flash(request, f"Nova API Key gerada: {new_api_key} (guarde em local seguro)", "success")
        return RedirectResponse(f"/admin/tenants/{tenant_id}/edit", status_code=303)
    except Exception as e:
        await db.rollback()
        flash(request, f"Erro ao regenerar API Key: {str(e)}", "danger")
        return RedirectResponse(f"/admin/tenants/{tenant_id}/edit", status_code=303)


# ==================== BOT CONFIGS ====================

@router.get("/configs", response_class=HTMLResponse)
async def list_configs(
    request: Request,
    tenant_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """List all bot configurations."""
    # Get all tenants for filter dropdown
    tenants_result = await db.execute(select(Tenant).order_by(Tenant.name))
    tenants = tenants_result.scalars().all()
    
    # Build query
    query = select(BotConfig).options(selectinload(BotConfig.tenant))
    if tenant_id:
        query = query.where(BotConfig.tenant_id == UUID(tenant_id))
    query = query.order_by(BotConfig.created_at.desc())
    
    result = await db.execute(query)
    configs = result.scalars().all()
    
    return templates.TemplateResponse("configs/list.html", {
        "request": request,
        "configs": configs,
        "tenants": tenants,
        "selected_tenant_id": tenant_id,
        "get_flashed_messages": lambda: get_flashed_messages(request)
    })


@router.get("/configs/new", response_class=HTMLResponse)
async def new_config_form(
    request: Request,
    tenant_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Show form to create new bot config."""
    tenants_result = await db.execute(select(Tenant).order_by(Tenant.name))
    tenants = tenants_result.scalars().all()
    
    return templates.TemplateResponse("configs/form.html", {
        "request": request,
        "config": None,
        "tenants": tenants,
        "selected_tenant_id": tenant_id,
        "get_flashed_messages": lambda: get_flashed_messages(request)
    })


@router.post("/configs/new")
async def create_config(
    request: Request,
    tenant_id: str = Form(...),
    persona_name: str = Form(""),
    system_prompt: str = Form(...),
    trigger_mode: str = Form("all"),
    trigger_keywords: str = Form(""),
    delay_min: int = Form(1),
    delay_max: int = Form(5),
    openai_api_key: str = Form(""),
    is_active: bool = Form(False),
    db: AsyncSession = Depends(get_db)
):
    """Create a new bot configuration."""
    try:
        config = BotConfig(
            tenant_id=UUID(tenant_id),
            persona_name=persona_name or None,
            system_prompt=system_prompt,
            trigger_mode=TriggerMode(trigger_mode),
            trigger_keywords=trigger_keywords or None,
            delay_min=delay_min,
            delay_max=delay_max,
            openai_api_key=openai_api_key or None,
            is_active=is_active if is_active else False
        )
        
        # If setting as active, deactivate others for the same tenant
        if config.is_active:
            await db.execute(
                select(BotConfig)
                .where(BotConfig.tenant_id == UUID(tenant_id))
                .where(BotConfig.is_active == True)
            )
            result = await db.execute(
                select(BotConfig)
                .where(BotConfig.tenant_id == UUID(tenant_id))
                .where(BotConfig.is_active == True)
            )
            for other_config in result.scalars():
                other_config.is_active = False
        
        db.add(config)
        await db.commit()
        
        flash(request, "Configuração criada com sucesso!", "success")
        return RedirectResponse("/admin/configs", status_code=303)
    except Exception as e:
        await db.rollback()
        flash(request, f"Erro ao criar configuração: {str(e)}", "danger")
        return RedirectResponse("/admin/configs/new", status_code=303)


@router.get("/configs/{config_id}/edit", response_class=HTMLResponse)
async def edit_config_form(
    request: Request,
    config_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Show form to edit bot config."""
    config = await db.get(BotConfig, UUID(config_id))
    if not config:
        flash(request, "Configuração não encontrada.", "danger")
        return RedirectResponse("/admin/configs", status_code=303)
    
    tenants_result = await db.execute(select(Tenant).order_by(Tenant.name))
    tenants = tenants_result.scalars().all()
    
    return templates.TemplateResponse("configs/form.html", {
        "request": request,
        "config": config,
        "tenants": tenants,
        "selected_tenant_id": None,
        "get_flashed_messages": lambda: get_flashed_messages(request)
    })


@router.post("/configs/{config_id}/edit")
async def update_config(
    request: Request,
    config_id: str,
    tenant_id: str = Form(...),
    persona_name: str = Form(""),
    system_prompt: str = Form(...),
    trigger_mode: str = Form("all"),
    trigger_keywords: str = Form(""),
    delay_min: int = Form(1),
    delay_max: int = Form(5),
    openai_api_key: str = Form(""),
    is_active: bool = Form(False),
    db: AsyncSession = Depends(get_db)
):
    """Update a bot configuration."""
    try:
        config = await db.get(BotConfig, UUID(config_id))
        if not config:
            flash(request, "Configuração não encontrada.", "danger")
            return RedirectResponse("/admin/configs", status_code=303)
        
        config.persona_name = persona_name or None
        config.system_prompt = system_prompt
        config.trigger_mode = TriggerMode(trigger_mode)
        config.trigger_keywords = trigger_keywords or None
        config.delay_min = delay_min
        config.delay_max = delay_max
        config.openai_api_key = openai_api_key or None
        
        # Handle is_active toggle
        is_active_val = is_active if is_active else False
        if is_active_val and not config.is_active:
            # Deactivate others for the same tenant
            result = await db.execute(
                select(BotConfig)
                .where(BotConfig.tenant_id == config.tenant_id)
                .where(BotConfig.is_active == True)
                .where(BotConfig.id != config.id)
            )
            for other_config in result.scalars():
                other_config.is_active = False
        
        config.is_active = is_active_val
        
        await db.commit()
        flash(request, "Configuração atualizada com sucesso!", "success")
        return RedirectResponse("/admin/configs", status_code=303)
    except Exception as e:
        await db.rollback()
        flash(request, f"Erro ao atualizar configuração: {str(e)}", "danger")
        return RedirectResponse(f"/admin/configs/{config_id}/edit", status_code=303)


@router.post("/configs/{config_id}/delete")
async def delete_config(
    request: Request,
    config_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a bot configuration."""
    try:
        config = await db.get(BotConfig, UUID(config_id))
        if config:
            await db.delete(config)
            await db.commit()
            flash(request, "Configuração excluída com sucesso!", "success")
        else:
            flash(request, "Configuração não encontrada.", "danger")
    except Exception as e:
        await db.rollback()
        flash(request, f"Erro ao excluir configuração: {str(e)}", "danger")
    
    return RedirectResponse("/admin/configs", status_code=303)


@router.post("/configs/{config_id}/activate")
async def activate_config(
    request: Request,
    config_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Activate a bot configuration."""
    try:
        config = await db.get(BotConfig, UUID(config_id))
        if not config:
            flash(request, "Configuração não encontrada.", "danger")
            return RedirectResponse("/admin/configs", status_code=303)
        
        # Deactivate others for the same tenant
        result = await db.execute(
            select(BotConfig)
            .where(BotConfig.tenant_id == config.tenant_id)
            .where(BotConfig.is_active == True)
        )
        for other_config in result.scalars():
            other_config.is_active = False
        
        config.is_active = True
        await db.commit()
        
        flash(request, "Configuração ativada com sucesso!", "success")
    except Exception as e:
        await db.rollback()
        flash(request, f"Erro ao ativar configuração: {str(e)}", "danger")
    
    return RedirectResponse("/admin/configs", status_code=303)


# ==================== LOGS ====================

@router.get("/logs", response_class=HTMLResponse)
async def list_logs(
    request: Request,
    tenant_id: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    message_type: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db)
):
    """List message logs with filters."""
    # Get tenants for filter
    tenants_result = await db.execute(select(Tenant).order_by(Tenant.name))
    tenants = tenants_result.scalars().all()
    
    mongodb = get_mongodb()
    logs = []
    total_pages = 1
    
    if mongodb is not None:
        # Build MongoDB query
        query = {}
        if tenant_id:
            query["tenant_id"] = tenant_id
        if phone:
            query["sender_phone"] = {"$regex": phone}
        if message_type:
            query["message_type"] = message_type
        if date:
            try:
                date_obj = datetime.strptime(date, "%Y-%m-%d")
                query["created_at"] = {
                    "$gte": date_obj,
                    "$lt": date_obj + timedelta(days=1)
                }
            except ValueError:
                pass
        
        # Pagination
        per_page = 20
        skip = (page - 1) * per_page
        
        total = await mongodb.message_logs.count_documents(query)
        total_pages = max(1, (total + per_page - 1) // per_page)
        
        cursor = mongodb.message_logs.find(query).sort("created_at", -1).skip(skip).limit(per_page)
        logs_data = await cursor.to_list(length=per_page)
        
        # Convert to objects for template
        logs = [
            type('Log', (), {
                'id': str(m.get('_id', '')),
                'tenant_id': m.get('tenant_id', ''),
                'session_id': m.get('session_id', ''),
                'sender_phone': m.get('sender_phone', ''),
                'message_type': m.get('message_type', 'text'),
                'content': m.get('content', ''),
                'transcription': m.get('transcription', ''),
                'ai_response': m.get('ai_response', ''),
                'processed': m.get('processed', False),
                'processed_at': m.get('processed_at'),
                'created_at': m.get('created_at')
            })()
            for m in logs_data
        ]
    
    # Build filters query string for pagination
    filters_query = "&".join([
        f"{k}={v}" for k, v in [
            ("tenant_id", tenant_id),
            ("phone", phone),
            ("message_type", message_type),
            ("date", date)
        ] if v
    ])
    
    return templates.TemplateResponse("logs/list.html", {
        "request": request,
        "logs": logs,
        "tenants": tenants,
        "filters": {
            "tenant_id": tenant_id,
            "phone": phone,
            "message_type": message_type,
            "date": date
        },
        "filters_query": filters_query,
        "current_page": page,
        "total_pages": total_pages,
        "get_flashed_messages": lambda: get_flashed_messages(request)
    })


@router.get("/logs/{log_id}/detail", response_class=HTMLResponse)
async def log_detail(request: Request, log_id: str):
    """Get log detail for modal."""
    from bson import ObjectId
    
    mongodb = get_mongodb()
    if mongodb is None:
        return HTMLResponse("<div class='alert alert-danger'>MongoDB não disponível</div>")
    
    try:
        log_data = await mongodb.message_logs.find_one({"_id": ObjectId(log_id)})
        if not log_data:
            return HTMLResponse("<div class='alert alert-danger'>Log não encontrado</div>")
        
        log = type('Log', (), {
            'id': str(log_data.get('_id', '')),
            'tenant_id': log_data.get('tenant_id', ''),
            'session_id': log_data.get('session_id', ''),
            'sender_phone': log_data.get('sender_phone', ''),
            'message_type': log_data.get('message_type', 'text'),
            'content': log_data.get('content', ''),
            'transcription': log_data.get('transcription', ''),
            'ai_response': log_data.get('ai_response', ''),
            'processed': log_data.get('processed', False),
            'processed_at': log_data.get('processed_at'),
            'created_at': log_data.get('created_at')
        })()
        
        return templates.TemplateResponse("logs/detail.html", {
            "request": request,
            "log": log
        })
    except Exception as e:
        return HTMLResponse(f"<div class='alert alert-danger'>Erro: {str(e)}</div>")
