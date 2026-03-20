"""Admin Funnel API routes — CRUD for funnels, nodes, and edges.

Protected by BRIDGE_AUTH_TOKEN (used by the Next.js admin panel).
"""

from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID, uuid4

from app.core.config import get_settings
from app.core.database import get_db
from app.domain.entities.funnel import Funnel, FunnelNode, FunnelEdge, NodeType
from app.infrastructure.repositories.funnel_repository import FunnelRepository
from app.api.schemas.funnel import (
    FunnelCreate,
    FunnelUpdate,
    FunnelResponse,
    FunnelDetailResponse,
    FunnelSaveRequest,
    FunnelNodeResponse,
    FunnelEdgeResponse,
)

router = APIRouter()
settings = get_settings()


async def verify_admin_token(
    authorization: Optional[str] = Header(None),
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Cabeçalho de autorização obrigatório")
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    if token != settings.BRIDGE_AUTH_TOKEN:
        raise HTTPException(status_code=401, detail="Token de admin inválido")


# ---- List / Get ----

@router.get("/", response_model=List[FunnelResponse])
async def list_funnels(
    tenant_id: Optional[UUID] = None,
    _=Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """List funnels, optionally filtered by tenant."""
    repo = FunnelRepository(db)
    if tenant_id:
        funnels = await repo.get_by_tenant_id(tenant_id)
    else:
        funnels = await repo.get_all()

    result = []
    for f in funnels:
        node_count = await repo.count_nodes(f.id)
        result.append(FunnelResponse(
            id=f.id,
            tenant_id=f.tenant_id,
            name=f.name,
            trigger_keywords=f.trigger_keywords or [],
            is_active=f.is_active,
            priority=f.priority,
            node_count=node_count,
            created_at=f.created_at,
            updated_at=f.updated_at,
        ))
    return result


@router.get("/{funnel_id}", response_model=FunnelDetailResponse)
async def get_funnel(
    funnel_id: UUID,
    _=Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """Get funnel with full graph (nodes + edges)."""
    repo = FunnelRepository(db)
    funnel = await repo.get_by_id_with_graph(funnel_id)
    if not funnel:
        raise HTTPException(status_code=404, detail="Funil não encontrado")

    return FunnelDetailResponse(
        id=funnel.id,
        tenant_id=funnel.tenant_id,
        name=funnel.name,
        trigger_keywords=funnel.trigger_keywords or [],
        is_active=funnel.is_active,
        priority=funnel.priority,
        node_count=len(funnel.nodes),
        created_at=funnel.created_at,
        updated_at=funnel.updated_at,
        nodes=[FunnelNodeResponse.model_validate(n) for n in funnel.nodes],
        edges=[FunnelEdgeResponse.model_validate(e) for e in funnel.edges],
    )


# ---- Create ----

@router.post("/", response_model=FunnelResponse, status_code=201)
async def create_funnel(
    data: FunnelCreate,
    _=Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """Create a new funnel (empty, no nodes yet)."""
    repo = FunnelRepository(db)
    funnel = Funnel(
        tenant_id=data.tenant_id,
        name=data.name,
        trigger_keywords=data.trigger_keywords,
        is_active=data.is_active,
        priority=data.priority,
    )
    created = await repo.create(funnel)
    return FunnelResponse(
        id=created.id,
        tenant_id=created.tenant_id,
        name=created.name,
        trigger_keywords=created.trigger_keywords or [],
        is_active=created.is_active,
        priority=created.priority,
        node_count=0,
        created_at=created.created_at,
        updated_at=created.updated_at,
    )


# ---- Update metadata ----

@router.put("/{funnel_id}", response_model=FunnelResponse)
async def update_funnel(
    funnel_id: UUID,
    data: FunnelUpdate,
    _=Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """Update funnel metadata (name, keywords, active, priority)."""
    repo = FunnelRepository(db)
    funnel = await repo.get_by_id(funnel_id)
    if not funnel:
        raise HTTPException(status_code=404, detail="Funil não encontrado")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(funnel, field, value)

    updated = await repo.update(funnel)
    node_count = await repo.count_nodes(funnel_id)
    return FunnelResponse(
        id=updated.id,
        tenant_id=updated.tenant_id,
        name=updated.name,
        trigger_keywords=updated.trigger_keywords or [],
        is_active=updated.is_active,
        priority=updated.priority,
        node_count=node_count,
        created_at=updated.created_at,
        updated_at=updated.updated_at,
    )


# ---- Save full graph (nodes + edges) ----

@router.put("/{funnel_id}/graph", response_model=FunnelDetailResponse)
async def save_funnel_graph(
    funnel_id: UUID,
    data: FunnelSaveRequest,
    _=Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """Save the entire funnel graph — replaces all nodes and edges.

    This is the main endpoint used by the visual editor.
    It performs a full replace: deletes existing nodes/edges and creates new ones.
    """
    repo = FunnelRepository(db)
    funnel = await repo.get_by_id(funnel_id)
    if not funnel:
        raise HTTPException(status_code=404, detail="Funil não encontrado")

    # Update funnel metadata if provided
    if data.tenant_id is not None:
        funnel.tenant_id = data.tenant_id
    if data.name is not None:
        funnel.name = data.name
    if data.trigger_keywords is not None:
        funnel.trigger_keywords = data.trigger_keywords
    if data.is_active is not None:
        funnel.is_active = data.is_active
    if data.priority is not None:
        funnel.priority = data.priority

    # ---- Upsert nodes: preserve existing IDs, create new ones for new nodes ----
    existing_nodes = {str(n.id): n for n in (await repo.get_nodes_by_funnel(funnel_id))}
    incoming_node_ids = set()
    id_map = {}  # client_id -> server_id (only for truly new nodes)
    created_nodes = []

    for node_data in data.nodes:
        client_id = str(node_data.id) if node_data.id else None
        node_type_val = node_data.type.value if hasattr(node_data.type, 'value') else str(node_data.type)

        if client_id and client_id in existing_nodes:
            # Update existing node in place
            existing = existing_nodes[client_id]
            existing.type = NodeType(node_type_val)
            existing.data = node_data.data
            existing.position_x = node_data.position_x
            existing.position_y = node_data.position_y
            await repo.update_node(existing)
            id_map[client_id] = existing.id
            incoming_node_ids.add(client_id)
            created_nodes.append(existing)
        else:
            # Create new node
            new_id = uuid4()
            node = FunnelNode(
                id=new_id,
                funnel_id=funnel_id,
                type=NodeType(node_type_val),
                data=node_data.data,
                position_x=node_data.position_x,
                position_y=node_data.position_y,
            )
            id_map[client_id or str(new_id)] = new_id
            created = await repo.add_node(node)
            incoming_node_ids.add(str(new_id))
            created_nodes.append(created)

    # Delete nodes that were removed in the editor
    for old_id, old_node in existing_nodes.items():
        if old_id not in incoming_node_ids:
            await repo.delete_node(old_node)

    # ---- Replace edges (delete all + recreate with correct mapped IDs) ----
    await repo.delete_edges_by_funnel(funnel_id)

    created_edges = []
    for edge_data in data.edges:
        source_id = id_map.get(str(edge_data.source_node_id))
        target_id = id_map.get(str(edge_data.target_node_id))
        if not source_id or not target_id:
            raise HTTPException(
                status_code=400,
                detail=f"Aresta referencia nó inexistente: {edge_data.source_node_id} -> {edge_data.target_node_id}",
            )
        edge = FunnelEdge(
            id=uuid4(),
            funnel_id=funnel_id,
            source_node_id=source_id,
            target_node_id=target_id,
            condition_label=edge_data.condition_label,
            condition_value=edge_data.condition_value,
            sort_order=edge_data.sort_order,
        )
        created = await repo.add_edge(edge)
        created_edges.append(created)

    await repo.update(funnel)

    return FunnelDetailResponse(
        id=funnel.id,
        tenant_id=funnel.tenant_id,
        name=funnel.name,
        trigger_keywords=funnel.trigger_keywords or [],
        is_active=funnel.is_active,
        priority=funnel.priority,
        node_count=len(created_nodes),
        created_at=funnel.created_at,
        updated_at=funnel.updated_at,
        nodes=[FunnelNodeResponse.model_validate(n) for n in created_nodes],
        edges=[FunnelEdgeResponse.model_validate(e) for e in created_edges],
    )


# ---- Delete ----

@router.delete("/{funnel_id}", status_code=204)
async def delete_funnel(
    funnel_id: UUID,
    _=Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """Delete a funnel and all its nodes/edges."""
    repo = FunnelRepository(db)
    funnel = await repo.get_by_id(funnel_id)
    if not funnel:
        raise HTTPException(status_code=404, detail="Funil não encontrado")
    await repo.delete(funnel_id)
    return None
