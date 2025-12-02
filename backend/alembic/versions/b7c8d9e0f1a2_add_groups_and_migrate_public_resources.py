# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

"""Add groups tables and migrate public resources to kinds

Revision ID: b7c8d9e0f1a2
Revises: a1b2c3d4e5f6
Create Date: 2025-12-02 10:00:00.000000+08:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = 'b7c8d9e0f1a2'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    1. Create groups and group_members tables
    2. Add group_id to kinds table
    3. Migrate public_models to kinds with user_id=0, kind='Model'
    4. Migrate public_shells to kinds with user_id=0, kind='Shell'
    5. Drop public_models and public_shells tables
    """
    # Create groups table
    op.create_table(
        'groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('parent_id', sa.Integer(), nullable=True),
        sa.Column('owner_user_id', sa.Integer(), nullable=False),
        sa.Column('visibility', sa.String(length=20), server_default='private', nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='1', nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.ForeignKeyConstraint(['owner_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['parent_id'], ['groups.id'], ),
        sa.PrimaryKeyConstraint('id'),
        mysql_charset='utf8mb4',
        mysql_collate='utf8mb4_unicode_ci',
        mysql_engine='InnoDB'
    )
    op.create_index('idx_groups_owner_user_id', 'groups', ['owner_user_id'], unique=False)
    op.create_index('idx_groups_parent_id', 'groups', ['parent_id'], unique=False)

    # Create group_members table
    op.create_table(
        'group_members',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('invited_by_user_id', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='1', nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ),
        sa.ForeignKeyConstraint(['invited_by_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        mysql_charset='utf8mb4',
        mysql_collate='utf8mb4_unicode_ci',
        mysql_engine='InnoDB'
    )
    op.create_index('idx_group_members_user_id', 'group_members', ['user_id'], unique=False)
    op.create_index('idx_group_user', 'group_members', ['group_id', 'user_id'], unique=True)

    # Add group_id to kinds table
    op.add_column('kinds', sa.Column('group_id', sa.Integer(), nullable=True))
    op.create_index('idx_kinds_group_id', 'kinds', ['group_id'], unique=False)
    op.create_foreign_key('fk_kinds_group_id', 'kinds', 'groups', ['group_id'], ['id'])

    # Migrate public_models to kinds
    # Check if public_models table exists
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    if 'public_models' in inspector.get_table_names():
        op.execute("""
            INSERT INTO kinds (user_id, kind, name, namespace, json, group_id, is_active, created_at, updated_at)
            SELECT
                0 as user_id,
                'Model' as kind,
                name,
                namespace,
                json,
                NULL as group_id,
                is_active,
                created_at,
                updated_at
            FROM public_models
            WHERE NOT EXISTS (
                SELECT 1 FROM kinds
                WHERE kinds.user_id = 0
                AND kinds.kind = 'Model'
                AND kinds.name = public_models.name
                AND kinds.namespace = public_models.namespace
            )
        """)

    # Migrate public_shells to kinds
    if 'public_shells' in inspector.get_table_names():
        op.execute("""
            INSERT INTO kinds (user_id, kind, name, namespace, json, group_id, is_active, created_at, updated_at)
            SELECT
                0 as user_id,
                'Shell' as kind,
                name,
                namespace,
                json,
                NULL as group_id,
                is_active,
                created_at,
                updated_at
            FROM public_shells
            WHERE NOT EXISTS (
                SELECT 1 FROM kinds
                WHERE kinds.user_id = 0
                AND kinds.kind = 'Shell'
                AND kinds.name = public_shells.name
                AND kinds.namespace = public_shells.namespace
            )
        """)

    # Drop old tables
    if 'public_models' in inspector.get_table_names():
        op.drop_table('public_models')
    if 'public_shells' in inspector.get_table_names():
        op.drop_table('public_shells')


def downgrade() -> None:
    """
    Reverse the migration:
    1. Recreate public_models and public_shells tables
    2. Migrate data back from kinds
    3. Remove group_id from kinds
    4. Drop group_members and groups tables
    """
    # Recreate public_models table
    op.create_table(
        'public_models',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('namespace', sa.String(length=100), server_default='default', nullable=False),
        sa.Column('json', sa.JSON(), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='1', nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', 'namespace', name='idx_public_model_name_namespace'),
        mysql_charset='utf8mb4',
        mysql_collate='utf8mb4_unicode_ci',
        mysql_engine='InnoDB'
    )

    # Recreate public_shells table
    op.create_table(
        'public_shells',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('namespace', sa.String(length=100), server_default='default', nullable=False),
        sa.Column('json', sa.JSON(), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='1', nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', 'namespace', name='idx_public_shell_name_namespace'),
        mysql_charset='utf8mb4',
        mysql_collate='utf8mb4_unicode_ci',
        mysql_engine='InnoDB'
    )

    # Migrate Models back to public_models
    op.execute("""
        INSERT INTO public_models (name, namespace, json, is_active, created_at, updated_at)
        SELECT name, namespace, json, is_active, created_at, updated_at
        FROM kinds
        WHERE user_id = 0 AND kind = 'Model'
    """)

    # Migrate Shells back to public_shells
    op.execute("""
        INSERT INTO public_shells (name, namespace, json, is_active, created_at, updated_at)
        SELECT name, namespace, json, is_active, created_at, updated_at
        FROM kinds
        WHERE user_id = 0 AND kind = 'Shell'
    """)

    # Remove group_id from kinds
    op.drop_constraint('fk_kinds_group_id', 'kinds', type_='foreignkey')
    op.drop_index('idx_kinds_group_id', 'kinds')
    op.drop_column('kinds', 'group_id')

    # Drop group tables
    op.drop_index('idx_group_user', 'group_members')
    op.drop_index('idx_group_members_user_id', 'group_members')
    op.drop_table('group_members')

    op.drop_index('idx_groups_parent_id', 'groups')
    op.drop_index('idx_groups_owner_user_id', 'groups')
    op.drop_table('groups')
