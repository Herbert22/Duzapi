"""
Celery Application Configuration.

Configures Celery with Redis as broker and backend for:
- Asynchronous message processing
- Delayed response sending (humanization)
- Task monitoring and retries
"""

from celery import Celery
from app.core.config import settings

# Create Celery application
celery_app = Celery(
    "whatsapp_automation",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.infrastructure.tasks.message_tasks",
        "app.infrastructure.tasks.funnel_tasks",
    ]
)

# Celery configuration
celery_app.conf.update(
    # Task settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Sao_Paulo",
    enable_utc=True,
    
    # Task execution settings
    task_acks_late=True,  # Acknowledge after task completion
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,  # Fair task distribution
    
    # Result settings
    result_expires=3600,  # Results expire after 1 hour
    
    # Retry settings
    task_default_retry_delay=60,  # 1 minute
    task_max_retries=3,
    
    # Task routing (optional, for multiple queues)
    task_routes={
        "app.infrastructure.tasks.message_tasks.process_and_respond_task": {
            "queue": "messages"
        },
        "app.infrastructure.tasks.message_tasks.send_whatsapp_message_task": {
            "queue": "messages"
        },
        "app.infrastructure.tasks.funnel_tasks.execute_funnel_task": {
            "queue": "messages"
        },
        "app.infrastructure.tasks.funnel_tasks.resume_funnel_after_wait": {
            "queue": "messages"
        }
    },
    
    # Beat schedule (for periodic tasks if needed)
    beat_schedule={},
)

# Optional: Configure task time limits
celery_app.conf.task_time_limit = 300  # 5 minutes max
celery_app.conf.task_soft_time_limit = 240  # 4 minutes soft limit
