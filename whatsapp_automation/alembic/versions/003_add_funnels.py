"""Add funnels, funnel_nodes, funnel_edges, contact_tags tables

Revision ID: 003_add_funnels
Revises: 002_add_ai_provider
Create Date: 2026-03-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB

revision = "003_add_funnels"
down_revision = "002_add_ai_provider"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- funnels ---
    op.create_table(
        "funnels",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("trigger_keywords", ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("priority", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # --- funnel_nodes ---
    op.create_table(
        "funnel_nodes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("funnel_id", UUID(as_uuid=True), sa.ForeignKey("funnels.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column(
            "type",
            sa.Enum(
                "start", "send_text", "send_image", "send_audio", "send_video",
                "send_document", "wait", "ask", "condition", "tag", "ai_response",
                name="nodetype",
            ),
            nullable=False,
        ),
        sa.Column("data", JSONB, nullable=False, server_default="{}"),
        sa.Column("position_x", sa.Float, nullable=False, server_default="0"),
        sa.Column("position_y", sa.Float, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # --- funnel_edges ---
    op.create_table(
        "funnel_edges",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("funnel_id", UUID(as_uuid=True), sa.ForeignKey("funnels.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("source_node_id", UUID(as_uuid=True), sa.ForeignKey("funnel_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_node_id", UUID(as_uuid=True), sa.ForeignKey("funnel_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("condition_label", sa.String(255), nullable=True),
        sa.Column("condition_value", sa.String(255), nullable=True),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
    )

    # --- contact_tags ---
    op.create_table(
        "contact_tags",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("session_id", sa.String(255), nullable=False, index=True),
        sa.Column("tag", sa.String(100), nullable=False),
        sa.Column("applied_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("applied_by_funnel_id", UUID(as_uuid=True), sa.ForeignKey("funnels.id", ondelete="SET NULL"), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("contact_tags")
    op.drop_table("funnel_edges")
    op.drop_table("funnel_nodes")
    op.execute("DROP TYPE IF EXISTS nodetype")
    op.drop_table("funnels")
