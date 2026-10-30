"""web orders, piece-to-order link, row level security

Revision ID: a4d2f6c8e1b7
Revises: 7c1e5a9d3b20
Create Date: 2026-10-30 22:10:00

Two things, both needed before real shop data arrives:

1. web_orders, and orders.web_order_id pointing at it. See models/web_orders.py.

2. Row level security ON for every table in the public schema.

   Supabase publishes every table in "public" through its automatic REST API
   (PostgREST), reachable with the project's publishable key - and that key is
   in the CRM frontend's JavaScript, because the login screen needs it. With
   RLS off, anyone could read the customer list straight from that API and
   never touch the backend or its staff check.

   RLS on with NO policies means the API roles (anon, authenticated) see
   nothing. The backend connects as the database owner, which RLS does not
   restrict, so the app is unaffected. The same statements are harmless on a
   plain local Postgres, where nothing uses those roles.

   The loop covers every table that exists when this runs. Any table added by
   a LATER migration must enable RLS itself; the test suite checks for that.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a4d2f6c8e1b7"
down_revision: Union[str, Sequence[str], None] = "7c1e5a9d3b20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "web_orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("woo_id", sa.Integer(), nullable=False),
        sa.Column("number", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("billing_name", sa.String(), nullable=True),
        sa.Column("ship_name", sa.String(), nullable=True),
        sa.Column("ship_company", sa.String(), nullable=True),
        sa.Column("ship_address_1", sa.String(), nullable=True),
        sa.Column("ship_address_2", sa.String(), nullable=True),
        sa.Column("ship_city", sa.String(), nullable=True),
        sa.Column("ship_county", sa.String(), nullable=True),
        sa.Column("ship_postcode", sa.String(length=16), nullable=True),
        sa.Column("ship_country", sa.String(length=2), nullable=True),
        sa.Column("shipping_method", sa.String(), nullable=True),
        sa.Column("shipping_total", sa.DECIMAL(10, 2), server_default="0", nullable=False),
        sa.Column("total", sa.DECIMAL(10, 2), server_default="0", nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="GBP", nullable=False),
        sa.Column("payment_method", sa.String(), nullable=True),
        sa.Column("customer_note", sa.String(), nullable=True),
        sa.Column("placed_at", sa.DateTime(), nullable=True),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
    )
    op.create_index("ix_web_orders_id", "web_orders", ["id"])
    op.create_index("ix_web_orders_woo_id", "web_orders", ["woo_id"], unique=True)
    op.create_index("ix_web_orders_number", "web_orders", ["number"])
    op.create_index("ix_web_orders_status", "web_orders", ["status"])
    op.create_index("ix_web_orders_customer_id", "web_orders", ["customer_id"])
    op.create_index("ix_web_orders_ship_postcode", "web_orders", ["ship_postcode"])

    op.add_column("orders", sa.Column("web_order_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "orders_web_order_id_fkey", "orders", "web_orders", ["web_order_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index("ix_orders_web_order_id", "orders", ["web_order_id"])

    op.execute(
        """
        DO $$
        DECLARE t record;
        BEGIN
            FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
                EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
            END LOOP;
        END $$;
        """
    )


def downgrade() -> None:
    op.drop_index("ix_orders_web_order_id", table_name="orders")
    op.drop_constraint("orders_web_order_id_fkey", "orders", type_="foreignkey")
    op.drop_column("orders", "web_order_id")
    op.drop_table("web_orders")
    # RLS is deliberately left on: turning it off would re-expose every table.
