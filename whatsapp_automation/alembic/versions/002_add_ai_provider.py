"""Add ai_provider column to bot_configs

Revision ID: 002_add_ai_provider
Revises: 001_initial_schema
Create Date: 2026-03-06
"""
from alembic import op
import sqlalchemy as sa

revision = "002_add_ai_provider"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "bot_configs",
        sa.Column("ai_provider", sa.String(20), nullable=False, server_default="gemini"),
    )


def downgrade() -> None:
    op.drop_column("bot_configs", "ai_provider")
