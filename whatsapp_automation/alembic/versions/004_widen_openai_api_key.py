"""Widen openai_api_key column from varchar(255) to text

Revision ID: 004_widen_openai_api_key
Revises: 003_add_funnels
Create Date: 2026-03-11
"""
from alembic import op
import sqlalchemy as sa

revision = "004_widen_openai_api_key"
down_revision = "003_add_funnels"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "bot_configs",
        "openai_api_key",
        existing_type=sa.String(255),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "bot_configs",
        "openai_api_key",
        existing_type=sa.Text(),
        type_=sa.String(255),
        existing_nullable=True,
    )
