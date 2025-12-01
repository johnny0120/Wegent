# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

"""Add coordinate mode support

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2025-07-01 10:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6g7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add WAITING_INPUT status and metadata column for coordinate mode support."""

    # Add WAITING_INPUT to subtask status enum
    # MySQL requires recreating the enum type
    op.execute("""
    ALTER TABLE subtasks
    MODIFY COLUMN status ENUM('PENDING', 'RUNNING', 'WAITING_INPUT', 'COMPLETED', 'FAILED', 'CANCELLED', 'DELETE')
    NOT NULL DEFAULT 'PENDING'
    """)

    # Add metadata column for coordinate mode metadata
    op.execute("""
    ALTER TABLE subtasks
    ADD COLUMN IF NOT EXISTS metadata JSON NULL
    """)


def downgrade() -> None:
    """Remove WAITING_INPUT status and metadata column."""

    # First update any WAITING_INPUT status to PENDING before removing from enum
    op.execute("""
    UPDATE subtasks SET status = 'PENDING' WHERE status = 'WAITING_INPUT'
    """)

    # Remove WAITING_INPUT from subtask status enum
    op.execute("""
    ALTER TABLE subtasks
    MODIFY COLUMN status ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'DELETE')
    NOT NULL DEFAULT 'PENDING'
    """)

    # Drop metadata column
    op.execute("""
    ALTER TABLE subtasks
    DROP COLUMN IF EXISTS metadata
    """)
