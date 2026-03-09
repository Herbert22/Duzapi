"""
WhatsApp Automation API - Main Application Entry Point

A multi-tenant WhatsApp automation system with AI-powered chatbot capabilities.
Built with FastAPI, PostgreSQL, MongoDB, and OpenAI.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.middleware.sessions import SessionMiddleware
import logging

from app.core.config import settings
from app.core.database import (
    engine,
    Base,
    connect_mongodb,
    close_mongodb,
)
from app.core.logging_config import setup_logging, CorrelationIdMiddleware

# Import routers
from app.api.routes import tenants, bot_configs, messages, webhooks
from app.admin.routes import router as admin_router
from app.api.routes.admin_bot_configs import router as admin_bot_configs_router
from app.api.routes.admin_messages import router as admin_messages_router
from app.api.routes.admin_funnels import router as admin_funnels_router
from app.api.routes.admin_uploads import router as admin_uploads_router

# Configure structured logging before anything else
setup_logging(level=settings.LOG_LEVEL, fmt=settings.LOG_FORMAT)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown events."""
    # Startup
    logger.info("Starting WhatsApp Automation API...")

    # Warn if running with default/weak secrets
    settings.validate_production_secrets()

    # Create PostgreSQL tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        logger.info("PostgreSQL tables created/verified")

    # Connect to MongoDB
    await connect_mongodb()
    logger.info("MongoDB connection established")

    logger.info(f"API ready at {settings.API_PREFIX}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down WhatsApp Automation API...")
    await close_mongodb()
    await engine.dispose()
    logger.info("Cleanup completed")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
    ## WhatsApp Automation API
    
    A multi-tenant system for WhatsApp automation with AI-powered chatbot capabilities.
    
    ### Features:
    - 🤖 **Multi-Persona AI Engine**: Configurable AI personas per tenant
    - 🎤 **Hybrid Processing**: Text and audio (Whisper transcription)
    - ⏱️ **Humanized Delays**: Configurable response delays via Celery
    - 🎯 **Smart Triggers**: Respond to all or keyword-based
    - 🏢 **Multi-Tenancy**: Each tenant has their own WhatsApp instance
    
    ### Authentication:
    Most endpoints require `X-API-Key` header with tenant's API key.
    """,
    openapi_url=f"{settings.API_PREFIX}/openapi.json",
    docs_url=f"{settings.API_PREFIX}/docs",
    redoc_url=f"{settings.API_PREFIX}/redoc",
    lifespan=lifespan
)

# Correlation ID middleware (must be added before CORS for proper header handling)
app.add_middleware(CorrelationIdMiddleware)

# Session Middleware (for admin flash messages)
app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception Handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with detailed messages."""
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"]
        })
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": errors}
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled errors."""
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"}
    )


# Health Check Endpoints
@app.get("/health", tags=["Health"])
async def health_check():
    """Basic health check endpoint."""
    return {"status": "healthy", "service": settings.APP_NAME}


@app.get(f"{settings.API_PREFIX}/health", tags=["Health"])
async def api_health_check():
    """API health check with version info."""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "debug": settings.DEBUG
    }


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information."""
    return {
        "message": "Welcome to WhatsApp Automation API",
        "docs": f"{settings.API_PREFIX}/docs",
        "health": "/health"
    }


# Register API routers
app.include_router(
    tenants.router, 
    prefix=f"{settings.API_PREFIX}/tenants", 
    tags=["Tenants"]
)
app.include_router(
    bot_configs.router, 
    prefix=f"{settings.API_PREFIX}/bot-configs", 
    tags=["Bot Configs"]
)
app.include_router(
    messages.router, 
    prefix=f"{settings.API_PREFIX}/messages", 
    tags=["Messages"]
)
app.include_router(
    webhooks.router, 
    prefix=f"{settings.API_PREFIX}/webhooks", 
    tags=["Webhooks"]
)

# Register Admin routers
app.include_router(
    admin_bot_configs_router,
    prefix=f"{settings.API_PREFIX}/admin/bot-configs",
    tags=["Admin Bot Configs"],
)
app.include_router(
    admin_messages_router,
    prefix=f"{settings.API_PREFIX}/admin/messages",
    tags=["Admin Messages"],
)
app.include_router(
    admin_funnels_router,
    prefix=f"{settings.API_PREFIX}/admin/funnels",
    tags=["Admin Funnels"],
)
app.include_router(
    admin_uploads_router,
    prefix=f"{settings.API_PREFIX}/admin/uploads",
    tags=["Admin Uploads"],
)
app.include_router(admin_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="debug" if settings.DEBUG else "info"
    )
