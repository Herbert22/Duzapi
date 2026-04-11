"""Add owner_id to tenants for multi-tenant isolation.

Revision ID: 005
Revises: 004
Create Date: 2026-04-10
"""

from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("owner_id", sa.String(255), nullable=True))
    op.create_index("ix_tenants_owner_id", "tenants", ["owner_id"])

    # Migrate existing tenant ownership
    op.execute("""
        UPDATE tenants SET owner_id = (SELECT id FROM "User" WHERE email = 'igorbregion.adv@gmail.com')
        WHERE id = '60fa2565-b489-4939-9299-9eb14f4f3ff2';
    """)
    op.execute("""
        UPDATE tenants SET owner_id = (SELECT id FROM "User" WHERE email = 'lucianobregion768@gmail.com')
        WHERE id = 'c2a5ab57-dcf4-421d-8dda-c1a310f2e99b';
    """)
    op.execute("""
        UPDATE tenants SET owner_id = (SELECT id FROM "User" WHERE email = 'herbertc12@outlook.com')
        WHERE id = '2b0f8c83-8fc3-43a4-b8d6-6a98aaa9f7c9';
    """)


def downgrade() -> None:
    op.drop_index("ix_tenants_owner_id", table_name="tenants")
    op.drop_column("tenants", "owner_id")
