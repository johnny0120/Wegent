# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

"""
API routes for Group and GroupMember management
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.group import (
    GroupCreate,
    GroupMemberCreate,
    GroupMemberUpdate,
    GroupMemberWithUser,
    GroupResponse,
    GroupUpdate,
    GroupWithMembers,
)
from app.services.group_service import GroupService

router = APIRouter()


@router.post("/groups", response_model=GroupResponse, status_code=201)
def create_group(
    group_data: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new group"""
    group = GroupService.create_group(db, group_data, current_user.id)
    return group


@router.get("/groups", response_model=List[GroupWithMembers])
def list_groups(
    include_public: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all groups accessible to the current user"""
    groups = GroupService.get_user_groups(db, current_user.id, include_public)
    return groups


@router.get("/groups/{group_name}", response_model=GroupResponse)
def get_group(
    group_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific group by name"""
    group = GroupService.get_group_by_name(db, group_name)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Check if user has access
    if group.visibility != "public":
        member = GroupService.get_member(db, group_name, current_user.id)
        if not member or not member.is_active:
            raise HTTPException(status_code=403, detail="Access denied")

    return group


@router.put("/groups/{group_name}", response_model=GroupResponse)
def update_group(
    group_name: str,
    group_data: GroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a group (only owner or admin)"""
    group = GroupService.update_group(db, group_name, group_data, current_user.id)
    return group


@router.delete("/groups/{group_name}", status_code=204)
def delete_group(
    group_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a group (only owner)"""
    GroupService.delete_group(db, group_name, current_user.id)
    return None


@router.post("/groups/{group_name}/members", response_model=GroupMemberWithUser, status_code=201)
def add_member(
    group_name: str,
    member_data: GroupMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a member to a group"""
    # Ensure group_name matches
    member_data.group_name = group_name
    member = GroupService.add_member(db, member_data, current_user.id)

    # Get user info
    from app.models.user import User
    user = db.query(User).filter(User.id == member.user_id).first()

    return GroupMemberWithUser(
        id=member.id,
        group_name=member.group_name,
        user_id=member.user_id,
        role=member.role,
        invited_by_user_id=member.invited_by_user_id,
        is_active=member.is_active,
        created_at=member.created_at,
        updated_at=member.updated_at,
        user_name=user.user_name if user else "",
        user_email=user.email if user else None,
    )


@router.get("/groups/{group_name}/members", response_model=List[GroupMemberWithUser])
def list_members(
    group_name: str,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all members of a group"""
    # Check if user has access
    group = GroupService.get_group_by_name(db, group_name)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group.visibility != "public":
        member = GroupService.get_member(db, group_name, current_user.id)
        if not member or not member.is_active:
            raise HTTPException(status_code=403, detail="Access denied")

    members = GroupService.get_group_members(db, group_name, include_inactive)
    return members


@router.put("/groups/{group_name}/members/{user_id}", response_model=GroupMemberWithUser)
def update_member_role(
    group_name: str,
    user_id: int,
    role_data: GroupMemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a member's role"""
    member = GroupService.update_member_role(db, group_name, user_id, role_data, current_user.id)

    # Get user info
    from app.models.user import User
    user = db.query(User).filter(User.id == member.user_id).first()

    return GroupMemberWithUser(
        id=member.id,
        group_name=member.group_name,
        user_id=member.user_id,
        role=member.role,
        invited_by_user_id=member.invited_by_user_id,
        is_active=member.is_active,
        created_at=member.created_at,
        updated_at=member.updated_at,
        user_name=user.user_name if user else "",
        user_email=user.email if user else None,
    )


@router.delete("/groups/{group_name}/members/{user_id}", status_code=204)
def remove_member(
    group_name: str,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a member from a group"""
    GroupService.remove_member(db, group_name, user_id, current_user.id)
    return None
