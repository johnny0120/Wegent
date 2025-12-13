# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

"""Add subscription tables for Smart Feed feature

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2025-12-13 10:00:00.000000+08:00

This migration adds tables for the Smart Feed (Subscription) feature:
1. subscriptions - Main subscription configuration
2. subscription_items - Collected information items
3. subscription_runs - Execution history records
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "i9j0k1l2m3n4"
down_revision: Union[str, None] = "h8i9j0k1l2m3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create subscription tables."""

    # Create subscriptions table
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False, index=True),
        sa.Column("namespace", sa.String(100), nullable=False, server_default="default"),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        # Team reference
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("team_name", sa.String(100), nullable=False),
        sa.Column("team_namespace", sa.String(100), nullable=False, server_default="default"),
        # Trigger configuration
        sa.Column("trigger_type", sa.String(20), nullable=False, server_default="cron"),
        sa.Column("cron_expression", sa.String(100), nullable=True),
        sa.Column("cron_timezone", sa.String(50), nullable=True, server_default="Asia/Shanghai"),
        sa.Column("webhook_secret", sa.String(100), nullable=True),
        # Alert policy
        sa.Column("alert_enabled", sa.Boolean(), server_default="1"),
        sa.Column("alert_prompt", sa.Text(), nullable=True),
        sa.Column("alert_keywords", sa.JSON(), nullable=True),
        # Retention policy
        sa.Column("retention_days", sa.Integer(), server_default="30"),
        # Status
        sa.Column("enabled", sa.Boolean(), server_default="1"),
        sa.Column("last_run_time", sa.DateTime(), nullable=True),
        sa.Column("last_run_status", sa.String(20), nullable=True),
        sa.Column("unread_count", sa.Integer(), server_default="0"),
        sa.Column("total_item_count", sa.Integer(), server_default="0"),
        # Metadata
        sa.Column("is_active", sa.Boolean(), server_default="1"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("ix_subscriptions_id", "subscriptions", ["id"])
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"])
    op.create_index("ix_subscriptions_namespace", "subscriptions", ["namespace"])
    op.create_index("ix_subscriptions_enabled", "subscriptions", ["enabled"])

    # Create subscription_runs table (before subscription_items due to foreign key)
    op.create_table(
        "subscription_runs",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("subscription_id", sa.Integer(), sa.ForeignKey("subscriptions.id"), nullable=False, index=True),
        sa.Column("task_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("items_collected", sa.Integer(), server_default="0"),
        sa.Column("items_alerted", sa.Integer(), server_default="0"),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("ix_subscription_runs_id", "subscription_runs", ["id"])
    op.create_index("ix_subscription_runs_subscription_id", "subscription_runs", ["subscription_id"])
    op.create_index("ix_subscription_runs_status", "subscription_runs", ["status"])

    # Create subscription_items table
    op.create_table(
        "subscription_items",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("subscription_id", sa.Integer(), sa.ForeignKey("subscriptions.id"), nullable=False, index=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("source_url", sa.String(1000), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        # Alert status
        sa.Column("should_alert", sa.Boolean(), server_default="0"),
        sa.Column("alert_reason", sa.String(500), nullable=True),
        # Read status
        sa.Column("is_read", sa.Boolean(), server_default="0"),
        # References
        sa.Column("task_id", sa.Integer(), nullable=True),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("subscription_runs.id"), nullable=True),
        # Metadata
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("ix_subscription_items_id", "subscription_items", ["id"])
    op.create_index("ix_subscription_items_subscription_id", "subscription_items", ["subscription_id"])
    op.create_index("ix_subscription_items_is_read", "subscription_items", ["is_read"])
    op.create_index("ix_subscription_items_should_alert", "subscription_items", ["should_alert"])
    op.create_index("ix_subscription_items_created_at", "subscription_items", ["created_at"])


def downgrade() -> None:
    """Drop subscription tables."""
    op.drop_table("subscription_items")
    op.drop_table("subscription_runs")
    op.drop_table("subscriptions")
