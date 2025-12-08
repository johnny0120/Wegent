# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

"""
Service layer for Group and GroupMember management
"""
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload

from app.models.group import Group, GroupMember
from app.models.user import User
from app.schemas.group import (
    GroupCreate,
    GroupMemberCreate,
    GroupMemberUpdate,
    GroupMemberWithUser,
    GroupUpdate,
    GroupWithMembers,
)


class GroupService:
    """Service for managing groups"""

    @staticmethod
    def create_group(db: Session, group_data: GroupCreate, owner_user_id: int) -> Group:
        """Create a new group"""
        # Check if group name already exists
        existing_group = db.query(Group).filter(Group.name == group_data.name).first()
        if existing_group:
            raise HTTPException(status_code=400, detail="Group name already exists")

        # Create group
        group = Group(
            name=group_data.name,
            display_name=group_data.display_name,
            description=group_data.description,
            visibility=group_data.visibility,
            parent_id=group_data.parent_id,
            owner_user_id=owner_user_id,
        )
        db.add(group)
        db.flush()

        # Add owner as a member with owner role
        owner_member = GroupMember(
            group_name=group.name,
            user_id=owner_user_id,
            role="owner",
            invited_by_user_id=owner_user_id,
        )
        db.add(owner_member)
        db.commit()
        db.refresh(group)

        return group

    @staticmethod
    def get_group_by_name(db: Session, name: str) -> Optional[Group]:
        """Get group by name"""
        return db.query(Group).filter(Group.name == name, Group.is_active == True).first()

    @staticmethod
    def get_group_by_id(db: Session, group_id: int) -> Optional[Group]:
        """Get group by ID"""
        return db.query(Group).filter(Group.id == group_id, Group.is_active == True).first()

    @staticmethod
    def get_user_groups(
        db: Session, user_id: int, include_public: bool = True
    ) -> List[GroupWithMembers]:
        """Get all groups that a user is a member of or can access"""
        # Get groups where user is a member
        query = (
            db.query(Group, GroupMember)
            .join(GroupMember, Group.name == GroupMember.group_name)
            .filter(
                and_(
                    Group.is_active == True,
                    GroupMember.user_id == user_id,
                    GroupMember.is_active == True,
                )
            )
        )

        user_groups = []
        for group, member in query.all():
            # Count active members
            member_count = (
                db.query(GroupMember)
                .filter(
                    GroupMember.group_name == group.name,
                    GroupMember.is_active == True,
                )
                .count()
            )

            group_data = GroupWithMembers(
                id=group.id,
                name=group.name,
                display_name=group.display_name,
                description=group.description,
                visibility=group.visibility,
                parent_id=group.parent_id,
                owner_user_id=group.owner_user_id,
                is_active=group.is_active,
                created_at=group.created_at,
                updated_at=group.updated_at,
                member_count=member_count,
                role=member.role,
            )
            user_groups.append(group_data)

        # Add public groups if requested
        if include_public:
            public_groups = (
                db.query(Group)
                .filter(
                    and_(
                        Group.is_active == True,
                        Group.visibility == "public",
                    )
                )
                .all()
            )

            for group in public_groups:
                # Skip if already in user_groups
                if any(g.id == group.id for g in user_groups):
                    continue

                member_count = (
                    db.query(GroupMember)
                    .filter(
                        GroupMember.group_name == group.name,
                        GroupMember.is_active == True,
                    )
                    .count()
                )

                group_data = GroupWithMembers(
                    id=group.id,
                    name=group.name,
                    display_name=group.display_name,
                    description=group.description,
                    visibility=group.visibility,
                    parent_id=group.parent_id,
                    owner_user_id=group.owner_user_id,
                    is_active=group.is_active,
                    created_at=group.created_at,
                    updated_at=group.updated_at,
                    member_count=member_count,
                    role=None,  # Not a member
                )
                user_groups.append(group_data)

        return user_groups

    @staticmethod
    def update_group(
        db: Session, group_name: str, group_data: GroupUpdate, user_id: int
    ) -> Group:
        """Update group (only owner or admin can update)"""
        group = GroupService.get_group_by_name(db, group_name)
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")

        # Check permission
        member = GroupService.get_member(db, group_name, user_id)
        if not member or member.role not in ["owner", "admin"]:
            raise HTTPException(
                status_code=403, detail="Only group owner or admin can update group"
            )

        # Update fields (name is immutable)
        if group_data.display_name is not None:
            group.display_name = group_data.display_name
        if group_data.description is not None:
            group.description = group_data.description
        if group_data.visibility is not None:
            group.visibility = group_data.visibility
        if group_data.parent_id is not None:
            group.parent_id = group_data.parent_id

        db.commit()
        db.refresh(group)
        return group

    @staticmethod
    def delete_group(db: Session, group_name: str, user_id: int) -> bool:
        """Delete group (soft delete, only owner can delete)"""
        group = GroupService.get_group_by_name(db, group_name)
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")

        # Check permission
        if group.owner_user_id != user_id:
            raise HTTPException(
                status_code=403, detail="Only group owner can delete group"
            )

        # Soft delete
        group.is_active = False
        db.commit()
        return True

    @staticmethod
    def add_member(
        db: Session, member_data: GroupMemberCreate, invited_by_user_id: int
    ) -> GroupMember:
        """Add a member to a group"""
        # Check if group exists
        group = GroupService.get_group_by_name(db, member_data.group_name)
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")

        # Check if inviter has permission
        inviter_member = GroupService.get_member(
            db, member_data.group_name, invited_by_user_id
        )
        if not inviter_member or inviter_member.role not in ["owner", "admin"]:
            raise HTTPException(
                status_code=403, detail="Only group owner or admin can add members"
            )

        # Check if user already exists
        existing_member = GroupService.get_member(db, member_data.group_name, member_data.user_id)
        if existing_member:
            if existing_member.is_active:
                raise HTTPException(status_code=400, detail="User is already a member")
            else:
                # Reactivate member
                existing_member.is_active = True
                existing_member.role = member_data.role
                existing_member.invited_by_user_id = invited_by_user_id
                db.commit()
                db.refresh(existing_member)
                return existing_member

        # Create new member
        member = GroupMember(
            group_name=member_data.group_name,
            user_id=member_data.user_id,
            role=member_data.role,
            invited_by_user_id=invited_by_user_id,
        )
        db.add(member)
        db.commit()
        db.refresh(member)
        return member

    @staticmethod
    def get_member(
        db: Session, group_name: str, user_id: int
    ) -> Optional[GroupMember]:
        """Get a specific group member"""
        return (
            db.query(GroupMember)
            .filter(
                GroupMember.group_name == group_name,
                GroupMember.user_id == user_id,
            )
            .first()
        )

    @staticmethod
    def get_group_members(
        db: Session, group_name: str, include_inactive: bool = False
    ) -> List[GroupMemberWithUser]:
        """Get all members of a group"""
        query = (
            db.query(GroupMember, User)
            .join(User, GroupMember.user_id == User.id)
            .filter(GroupMember.group_name == group_name)
        )

        if not include_inactive:
            query = query.filter(GroupMember.is_active == True)

        members = []
        for member, user in query.all():
            member_data = GroupMemberWithUser(
                id=member.id,
                group_name=member.group_name,
                user_id=member.user_id,
                role=member.role,
                invited_by_user_id=member.invited_by_user_id,
                is_active=member.is_active,
                created_at=member.created_at,
                updated_at=member.updated_at,
                user_name=user.user_name,
                user_email=user.email,
            )
            members.append(member_data)

        return members

    @staticmethod
    def update_member_role(
        db: Session, group_name: str, user_id: int, role_data: GroupMemberUpdate, updater_user_id: int
    ) -> GroupMember:
        """Update member role"""
        # Check permission
        updater_member = GroupService.get_member(db, group_name, updater_user_id)
        if not updater_member or updater_member.role not in ["owner", "admin"]:
            raise HTTPException(
                status_code=403, detail="Only group owner or admin can update member roles"
            )

        # Get target member
        member = GroupService.get_member(db, group_name, user_id)
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")

        # Cannot change owner role
        if member.role == "owner":
            raise HTTPException(status_code=400, detail="Cannot change owner role")

        # Update role
        if role_data.role:
            member.role = role_data.role

        db.commit()
        db.refresh(member)
        return member

    @staticmethod
    def remove_member(
        db: Session, group_name: str, user_id: int, remover_user_id: int
    ) -> bool:
        """Remove a member from a group"""
        # Check permission
        remover_member = GroupService.get_member(db, group_name, remover_user_id)
        if not remover_member or remover_member.role not in ["owner", "admin"]:
            raise HTTPException(
                status_code=403, detail="Only group owner or admin can remove members"
            )

        # Get target member
        member = GroupService.get_member(db, group_name, user_id)
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")

        # Cannot remove owner
        if member.role == "owner":
            raise HTTPException(status_code=400, detail="Cannot remove group owner")

        # Soft delete
        member.is_active = False
        db.commit()
        return True
