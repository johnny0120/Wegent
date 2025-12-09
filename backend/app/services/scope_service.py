# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

"""
Scope service for unified resource CRUD with scope parameter support
"""
import logging
from enum import Enum
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.group_member import GroupMember
from app.models.user import User
from app.schemas.group import GroupRole
from app.services.group_service import GroupPermission

logger = logging.getLogger(__name__)


class ScopeType(str, Enum):
    """Scope type enumeration for resource operations"""

    DEFAULT = "default"  # Personal resources
    ALL = "all"  # All accessible resources (query only)
    GROUP = "group"  # Group resources


class ScopeInfo:
    """Parsed scope information"""

    def __init__(
        self,
        scope_type: ScopeType,
        group_name: Optional[str] = None,
    ):
        self.scope_type = scope_type
        self.group_name = group_name

    def __repr__(self):
        if self.scope_type == ScopeType.GROUP and self.group_name:
            return f"ScopeInfo(type={self.scope_type}, group={self.group_name})"
        return f"ScopeInfo(type={self.scope_type})"


class ScopeService:
    """Service for scope parameter parsing and permission validation"""

    @staticmethod
    def parse_scope(scope: Optional[str] = None) -> ScopeInfo:
        """
        Parse scope parameter into ScopeInfo object.

        Args:
            scope: Scope string, one of:
                - None or "default": Personal resources
                - "all": All accessible resources (query only)
                - "group:{name}": Group resources

        Returns:
            ScopeInfo object with parsed information

        Raises:
            HTTPException: If scope format is invalid
        """
        if not scope or scope == "default":
            return ScopeInfo(ScopeType.DEFAULT)

        if scope == "all":
            return ScopeInfo(ScopeType.ALL)

        if scope.startswith("group:"):
            group_name = scope[6:]  # Remove "group:" prefix
            if not group_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Group name cannot be empty in scope parameter",
                )
            return ScopeInfo(ScopeType.GROUP, group_name=group_name)

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid scope format: {scope}. Expected 'default', 'all', or 'group:{{name}}'",
        )

    @staticmethod
    def get_user_groups(db: Session, user_id: int) -> List[str]:
        """
        Get all active group names where the user is a member.

        Args:
            db: Database session
            user_id: User ID

        Returns:
            List of group names
        """
        memberships = (
            db.query(GroupMember.group_name)
            .filter(
                GroupMember.user_id == user_id,
                GroupMember.is_active == True,
            )
            .all()
        )
        return [m.group_name for m in memberships]

    @staticmethod
    def get_user_role_in_group(
        db: Session, group_name: str, user_id: int
    ) -> Optional[GroupRole]:
        """
        Get user's role in a specific group (without parent inheritance).

        Args:
            db: Database session
            group_name: Group name
            user_id: User ID

        Returns:
            GroupRole or None if not a member
        """
        membership = (
            db.query(GroupMember)
            .filter(
                GroupMember.group_name == group_name,
                GroupMember.user_id == user_id,
                GroupMember.is_active == True,
            )
            .first()
        )
        return GroupRole(membership.role) if membership else None

    @staticmethod
    def validate_group_access(
        db: Session,
        group_name: str,
        user_id: int,
        required_permission: Optional[str] = None,
    ) -> Tuple[bool, Optional[GroupRole]]:
        """
        Validate if user has access to a group and optionally check specific permission.

        Args:
            db: Database session
            group_name: Group name to validate
            user_id: User ID
            required_permission: Optional specific permission to check
                (e.g., "view", "create", "edit", "delete")

        Returns:
            Tuple of (has_access, user_role)

        Raises:
            HTTPException: If group not found or user has no access
        """
        from app.models.group import Group

        # Check if group exists
        group = db.query(Group).filter(Group.name == group_name, Group.is_active == True).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Group '{group_name}' not found",
            )

        # Get user's role in the group
        role = ScopeService.get_user_role_in_group(db, group_name, user_id)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You are not a member of group '{group_name}'",
            )

        # Check specific permission if required
        if required_permission:
            has_perm = GroupPermission.has_permission(role, required_permission)
            if not has_perm:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"You do not have '{required_permission}' permission in group '{group_name}'. Required role: {_get_required_role_for_permission(required_permission)}",
                )

        return True, role

    @staticmethod
    def validate_scope_for_operation(
        scope_info: ScopeInfo,
        operation: str,
    ) -> None:
        """
        Validate if scope is allowed for the operation.

        Args:
            scope_info: Parsed scope information
            operation: Operation type ("list", "get", "create", "update", "delete")

        Raises:
            HTTPException: If scope is not allowed for the operation
        """
        # "all" scope is only allowed for list operations
        if scope_info.scope_type == ScopeType.ALL and operation != "list":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Scope 'all' is only allowed for list operations, not for '{operation}'",
            )


def _get_required_role_for_permission(permission: str) -> str:
    """Helper to get human-readable required role for a permission"""
    role_map = {
        "view": "Reporter or above",
        "create": "Developer or above",
        "edit": "Developer or above",
        "delete": "Maintainer or above",
    }
    return role_map.get(permission, "Unknown")


# Singleton instance
scope_service = ScopeService()
