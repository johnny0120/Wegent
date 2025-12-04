# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

"""
Group service with permission management
"""
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.group import Group
from app.models.group_member import GroupMember
from app.models.kind import Kind
from app.models.user import User
from app.schemas.group import (
    GroupCreate,
    GroupDetail,
    GroupListItem,
    GroupMemberInvite,
    GroupMemberListItem,
    GroupMemberUpdate,
    GroupRole,
    GroupUpdate,
)
from app.services.base import BaseService


class GroupPermission:
    """Group permission checker"""

    # Permission matrix
    PERMISSIONS = {
        GroupRole.OWNER: {
            "view": True,
            "create": True,
            "edit": True,
            "delete": True,
            "invite": True,
            "remove_member": True,
            "change_role": True,
            "delete_group": True,
            "transfer_ownership": True,
        },
        GroupRole.MAINTAINER: {
            "view": True,
            "create": True,
            "edit": True,
            "delete": True,
            "invite": True,
            "remove_member": True,
            "change_role": True,  # Cannot change Owner
            "delete_group": False,
            "transfer_ownership": False,
        },
        GroupRole.DEVELOPER: {
            "view": True,
            "create": True,
            "edit": True,
            "delete": False,
            "invite": False,
            "remove_member": False,
            "change_role": False,
            "delete_group": False,
            "transfer_ownership": False,
        },
        GroupRole.REPORTER: {
            "view": True,
            "create": False,
            "edit": False,
            "delete": False,
            "invite": False,
            "remove_member": False,
            "change_role": False,
            "delete_group": False,
            "transfer_ownership": False,
        },
    }

    @classmethod
    def has_permission(cls, role: GroupRole, permission: str) -> bool:
        """Check if role has specific permission"""
        return cls.PERMISSIONS.get(role, {}).get(permission, False)

    @classmethod
    def get_highest_role(cls, roles: List[GroupRole]) -> Optional[GroupRole]:
        """Get highest role from a list of roles"""
        role_priority = {
            GroupRole.OWNER: 4,
            GroupRole.MAINTAINER: 3,
            GroupRole.DEVELOPER: 2,
            GroupRole.REPORTER: 1,
        }
        if not roles:
            return None
        return max(roles, key=lambda r: role_priority.get(r, 0))


class GroupService(BaseService[Group, GroupCreate, GroupUpdate]):
    """Group service with hierarchical permission management"""

    def __init__(self, db: Session):
        super().__init__(Group)
        self.db = db

    def get_user_role_in_group(
        self, group_id: int, user_id: int, check_parents: bool = True
    ) -> Optional[GroupRole]:
        """
        Get user's role in a group, considering parent groups if check_parents=True
        Returns the highest role found in the group hierarchy
        """
        if check_parents:
            # Get all ancestor groups (including current group)
            ancestor_ids = self._get_ancestor_group_ids(group_id)

            # Query all memberships in ancestor groups
            memberships = (
                self.db.query(GroupMember)
                .filter(
                    and_(
                        GroupMember.group_id.in_(ancestor_ids),
                        GroupMember.user_id == user_id,
                        GroupMember.is_active == True,
                    )
                )
                .all()
            )

            if not memberships:
                return None

            # Return highest role
            roles = [GroupRole(m.role) for m in memberships]
            return GroupPermission.get_highest_role(roles)
        else:
            # Only check direct membership
            membership = (
                self.db.query(GroupMember)
                .filter(
                    and_(
                        GroupMember.group_id == group_id,
                        GroupMember.user_id == user_id,
                        GroupMember.is_active == True,
                    )
                )
                .first()
            )
            return GroupRole(membership.role) if membership else None

    def _get_ancestor_group_ids(self, group_id: int) -> List[int]:
        """Get all ancestor group IDs including the group itself"""
        ancestor_ids = [group_id]
        current_id = group_id

        # Recursive query to find all parent groups
        while current_id:
            group = self.db.query(Group).filter(Group.id == current_id).first()
            if group and group.parent_id and group.parent_id not in ancestor_ids:
                ancestor_ids.append(group.parent_id)
                current_id = group.parent_id
            else:
                break

        return ancestor_ids

    def check_permission(
        self, group_id: int, user_id: int, permission: str
    ) -> Tuple[bool, Optional[GroupRole]]:
        """
        Check if user has permission in group
        Returns (has_permission, user_role)
        """
        role = self.get_user_role_in_group(group_id, user_id)
        if not role:
            return False, None
        return GroupPermission.has_permission(role, permission), role

    def create_group(
        self, group_create: GroupCreate, owner_user_id: int
    ) -> Group:
        """Create a new group with owner as the creator"""
        # Validate parent group if specified
        if group_create.parent_id:
            parent_group = self.db.query(Group).filter(Group.id == group_create.parent_id).first()
            if not parent_group:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Parent group not found"
                )

            # Check if user has Maintainer+ permission in parent group
            has_perm, _ = self.check_permission(
                group_create.parent_id, owner_user_id, "create"
            )
            if not has_perm:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No permission to create subgroup in parent group"
                )

        # Create group
        group = Group(
            name=group_create.name,
            parent_id=group_create.parent_id,
            owner_user_id=owner_user_id,
            description=group_create.description,
            visibility="private",
        )
        self.db.add(group)
        self.db.flush()

        # Add owner as member
        member = GroupMember(
            group_id=group.id,
            user_id=owner_user_id,
            role=GroupRole.OWNER.value,
            invited_by_user_id=None,
        )
        self.db.add(member)
        self.db.commit()
        self.db.refresh(group)

        return group

    def list_user_groups(
        self, user_id: int, skip: int = 0, limit: int = 100
    ) -> Tuple[List[GroupListItem], int]:
        """List all groups where user is a member"""
        # Get groups where user is a member
        query = (
            self.db.query(Group)
            .join(GroupMember, Group.id == GroupMember.group_id)
            .filter(
                and_(
                    GroupMember.user_id == user_id,
                    GroupMember.is_active == True,
                    Group.is_active == True,
                )
            )
            .order_by(Group.created_at.desc())
        )

        total = query.count()
        groups = query.offset(skip).limit(limit).all()

        # Build response items
        items = []
        for group in groups:
            # Get member count
            member_count = (
                self.db.query(func.count(GroupMember.id))
                .filter(
                    and_(
                        GroupMember.group_id == group.id,
                        GroupMember.is_active == True,
                    )
                )
                .scalar()
            )

            # Get resource count
            resource_count = (
                self.db.query(func.count(Kind.id))
                .filter(and_(Kind.group_id == group.id, Kind.is_active == True))
                .scalar()
            )

            # Get user's role
            role = self.get_user_role_in_group(group.id, user_id, check_parents=False)

            items.append(
                GroupListItem(
                    id=group.id,
                    name=group.name,
                    parent_id=group.parent_id,
                    description=group.description,
                    member_count=member_count,
                    resource_count=resource_count,
                    my_role=role,
                    created_at=group.created_at,
                )
            )

        return items, total

    def get_group_detail(self, group_id: int, user_id: int) -> GroupDetail:
        """Get group detail with permission check"""
        group = self.db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
            )

        # Check view permission
        has_perm, role = self.check_permission(group_id, user_id, "view")
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No permission to view this group"
            )

        # Get counts
        member_count = (
            self.db.query(func.count(GroupMember.id))
            .filter(
                and_(GroupMember.group_id == group_id, GroupMember.is_active == True)
            )
            .scalar()
        )

        resource_count = (
            self.db.query(func.count(Kind.id))
            .filter(and_(Kind.group_id == group_id, Kind.is_active == True))
            .scalar()
        )

        # Get owner name
        owner = self.db.query(User).filter(User.id == group.owner_user_id).first()
        owner_name = owner.user_name if owner else "Unknown"

        return GroupDetail(
            id=group.id,
            name=group.name,
            parent_id=group.parent_id,
            owner_user_id=group.owner_user_id,
            visibility=group.visibility,
            description=group.description,
            is_active=group.is_active,
            created_at=group.created_at,
            updated_at=group.updated_at,
            member_count=member_count,
            resource_count=resource_count,
            my_role=role,
            owner_name=owner_name,
        )

    def update_group(
        self, group_id: int, user_id: int, group_update: GroupUpdate
    ) -> Group:
        """Update group information"""
        # Check permission
        has_perm, _ = self.check_permission(group_id, user_id, "edit")
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No permission to edit this group"
            )

        group = self.db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
            )

        # Update fields
        if group_update.name is not None:
            group.name = group_update.name
        if group_update.description is not None:
            group.description = group_update.description

        self.db.commit()
        self.db.refresh(group)
        return group

    def delete_group(self, group_id: int, user_id: int) -> None:
        """Delete a group (only Owner can delete)"""
        # Check permission (any Owner can delete)
        has_perm, role = self.check_permission(group_id, user_id, "delete_group")
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only group owners can delete the group"
            )

        group = self.db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Group not found"
            )

        # Check if group has subgroups
        subgroups_count = (
            self.db.query(func.count(Group.id))
            .filter(Group.parent_id == group_id)
            .scalar()
        )
        if subgroups_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete group with subgroups"
            )

        # Check if group has resources
        resources_count = (
            self.db.query(func.count(Kind.id))
            .filter(Kind.group_id == group_id)
            .scalar()
        )
        if resources_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete group with resources"
            )

        # Delete all group members first
        self.db.query(GroupMember).filter(GroupMember.group_id == group_id).delete()
        
        # Hard delete group
        self.db.delete(group)
        self.db.commit()

    # Member management methods
    def list_group_members(
        self, group_id: int, user_id: int, skip: int = 0, limit: int = 100
    ) -> Tuple[List[GroupMemberListItem], int]:
        """List group members"""
        # Check view permission
        has_perm, _ = self.check_permission(group_id, user_id, "view")
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No permission to view group members"
            )

        # Query members
        query = (
            self.db.query(GroupMember)
            .options(joinedload(GroupMember.user), joinedload(GroupMember.invited_by))
            .filter(
                and_(GroupMember.group_id == group_id, GroupMember.is_active == True)
            )
            .order_by(GroupMember.created_at.desc())
        )

        total = query.count()
        members = query.offset(skip).limit(limit).all()

        items = [
            GroupMemberListItem(
                id=m.id,
                user_id=m.user_id,
                user_name=m.user.user_name if m.user else "Unknown",
                role=GroupRole(m.role),
                invited_by_user_id=m.invited_by_user_id,
                invited_by_user_name=m.invited_by.user_name if m.invited_by else None,
                created_at=m.created_at,
            )
            for m in members
        ]

        return items, total

    def invite_member(
        self, group_id: int, inviter_user_id: int, invite: GroupMemberInvite
    ) -> GroupMember:
        """Invite a member to the group"""
        # Check invite permission
        has_perm, _ = self.check_permission(group_id, inviter_user_id, "invite")
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No permission to invite members"
            )

        # Find user by username
        user = self.db.query(User).filter(User.user_name == invite.user_name).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Check if already a member
        existing = (
            self.db.query(GroupMember)
            .filter(
                and_(
                    GroupMember.group_id == group_id,
                    GroupMember.user_id == user.id,
                    GroupMember.is_active == True,
                )
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a member"
            )

        # Create membership
        member = GroupMember(
            group_id=group_id,
            user_id=user.id,
            role=invite.role.value,
            invited_by_user_id=inviter_user_id,
        )
        self.db.add(member)
        self.db.commit()
        self.db.refresh(member)

        return member

    def update_member_role(
        self, group_id: int, user_id: int, target_user_id: int, update: GroupMemberUpdate
    ) -> GroupMember:
        """Update member role"""
        # Check change_role permission
        has_perm, role = self.check_permission(group_id, user_id, "change_role")
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No permission to change member roles"
            )

        # Get target member
        member = (
            self.db.query(GroupMember)
            .filter(
                and_(
                    GroupMember.group_id == group_id,
                    GroupMember.user_id == target_user_id,
                    GroupMember.is_active == True,
                )
            )
            .first()
        )
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Member not found"
            )

        # Maintainer cannot change Owner role
        if role == GroupRole.MAINTAINER and GroupRole(member.role) == GroupRole.OWNER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot change owner's role"
            )

        # Allow multiple Owners - no special handling needed
        # Just update the role directly

        member.role = update.role.value
        self.db.commit()
        self.db.refresh(member)

        return member

    def remove_member(
        self, group_id: int, user_id: int, target_user_id: int
    ) -> None:
        """Remove a member from the group"""
        # Check remove_member permission
        has_perm, _ = self.check_permission(group_id, user_id, "remove_member")
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No permission to remove members"
            )

        # Get target member
        member = (
            self.db.query(GroupMember)
            .filter(
                and_(
                    GroupMember.group_id == group_id,
                    GroupMember.user_id == target_user_id,
                    GroupMember.is_active == True,
                )
            )
            .first()
        )
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Member not found"
            )

        # Check if removing the last owner
        if GroupRole(member.role) == GroupRole.OWNER:
            # Count remaining owners
            owner_count = (
                self.db.query(GroupMember)
                .filter(
                    and_(
                        GroupMember.group_id == group_id,
                        GroupMember.role == GroupRole.OWNER.value,
                        GroupMember.is_active == True,
                    )
                )
                .count()
            )
            if owner_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot remove the last owner. Group must have at least one owner."
                )

        # Transfer user's resources to group owner
        group = self.db.query(Group).filter(Group.id == group_id).first()
        self.db.query(Kind).filter(
            and_(Kind.group_id == group_id, Kind.user_id == target_user_id)
        ).update({Kind.user_id: group.owner_user_id})

        # Hard delete membership
        self.db.delete(member)
        self.db.commit()

    def leave_group(self, group_id: int, user_id: int) -> None:
        """User leaves a group"""
        # Get user's membership
        member = (
            self.db.query(GroupMember)
            .filter(
                and_(
                    GroupMember.group_id == group_id,
                    GroupMember.user_id == user_id,
                    GroupMember.is_active == True,
                )
            )
            .first()
        )
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Not a member of this group"
            )

        # Check if leaving as the last owner
        if GroupRole(member.role) == GroupRole.OWNER:
            # Count remaining owners
            owner_count = (
                self.db.query(GroupMember)
                .filter(
                    and_(
                        GroupMember.group_id == group_id,
                        GroupMember.role == GroupRole.OWNER.value,
                        GroupMember.is_active == True,
                    )
                )
                .count()
            )
            if owner_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot leave as the last owner. Group must have at least one owner."
                )

        # Transfer user's resources to group owner
        group = self.db.query(Group).filter(Group.id == group_id).first()
        self.db.query(Kind).filter(
            and_(Kind.group_id == group_id, Kind.user_id == user_id)
        ).update({Kind.user_id: group.owner_user_id})

        # Hard delete membership
        self.db.delete(member)
        self.db.commit()

    def transfer_ownership(
        self, group_id: int, current_owner_id: int, new_owner_id: int
    ) -> None:
        """Transfer group ownership"""
        # Check transfer_ownership permission
        has_perm, role = self.check_permission(
            group_id, current_owner_id, "transfer_ownership"
        )
        if not has_perm or role != GroupRole.OWNER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owner can transfer ownership"
            )

        # Get new owner's membership
        new_owner_member = (
            self.db.query(GroupMember)
            .filter(
                and_(
                    GroupMember.group_id == group_id,
                    GroupMember.user_id == new_owner_id,
                    GroupMember.is_active == True,
                )
            )
            .first()
        )
        if not new_owner_member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="New owner is not a member of the group"
            )

        # New owner must be at least Maintainer
        if GroupRole(new_owner_member.role) not in [
            GroupRole.OWNER,
            GroupRole.MAINTAINER,
        ]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New owner must be a Maintainer"
            )

        # Get current owner's membership
        current_owner_member = (
            self.db.query(GroupMember)
            .filter(
                and_(
                    GroupMember.group_id == group_id,
                    GroupMember.user_id == current_owner_id,
                    GroupMember.is_active == True,
                )
            )
            .first()
        )

        # Update group owner
        group = self.db.query(Group).filter(Group.id == group_id).first()
        group.owner_user_id = new_owner_id

        # Update roles
        new_owner_member.role = GroupRole.OWNER.value
        current_owner_member.role = GroupRole.MAINTAINER.value

        self.db.commit()

    def invite_all_users(
        self, group_id: int, owner_id: int, role: GroupRole = GroupRole.REPORTER
    ) -> int:
        """Invite all users to the group (Owner only)"""
        # Check permission (must be Owner)
        has_perm, user_role = self.check_permission(group_id, owner_id, "invite")
        if not has_perm or user_role != GroupRole.OWNER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only group owner can invite all users"
            )

        # Get all active users
        all_users = self.db.query(User).filter(User.is_active == True).all()

        # Get existing members
        existing_member_ids = {
            m.user_id
            for m in self.db.query(GroupMember.user_id)
            .filter(
                and_(GroupMember.group_id == group_id, GroupMember.is_active == True)
            )
            .all()
        }

        # Invite users who are not already members
        count = 0
        for user in all_users:
            if user.id not in existing_member_ids:
                member = GroupMember(
                    group_id=group_id,
                    user_id=user.id,
                    role=role.value,
                    invited_by_user_id=owner_id,
                )
                self.db.add(member)
                count += 1

        self.db.commit()
        return count
