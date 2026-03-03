"""Initial schema — tenants and bot_configs tables.

Revision ID: 001
Revises:
Create Date: 2026-03-02
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- tenants ---
    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("phone_number", sa.String(20), nullable=False),
        sa.Column("api_key", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_tenants_phone_number", "tenants", ["phone_number"], unique=True)
    op.create_index("ix_tenants_api_key", "tenants", ["api_key"], unique=True)

    # --- bot_configs ---
    trigger_mode_enum = postgresql.ENUM("all", "keywords", name="triggermode", create_type=True)
    trigger_mode_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "bot_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("persona_name", sa.String(100), nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("response_delay_min", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("response_delay_max", sa.Integer(), nullable=False, server_default="5"),
        sa.Column(
            "trigger_mode",
            sa.Enum("all", "keywords", name="triggermode"),
            nullable=False,
            server_default="all",
        ),
        sa.Column(
            "trigger_keywords",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("openai_api_key", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_bot_configs_tenant_id", "bot_configs", ["tenant_id"])


def downgrade() -> None:
    op.drop_table("bot_configs")
    op.drop_table("tenants")
    op.execute("DROP TYPE IF EXISTS triggermode")
