"""integration state for the shop sync

Revision ID: 7c1e5a9d3b20
Revises: 2de5f8f8b198
Create Date: 2026-10-30 21:30:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "7c1e5a9d3b20"
down_revision: Union[str, Sequence[str], None] = "2de5f8f8b198"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "integration_state",
        sa.Column("key", sa.String(length=64), primary_key=True),
        sa.Column("value", sa.String(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("integration_state")
