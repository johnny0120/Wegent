# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

"""
Group API endpoints
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.core import security
from app.models.user import User
from app.schemas.group import (
    GroupCreate,
    GroupDetail,
    GroupListResponse,
    GroupMemberInvite,
    GroupMemberListResponse,
    GroupMemberUpdate,
    GroupUpdate,
    InviteAllUsersRequest,
    TransferOwnershipRequest,
)
from app.services.group_service import GroupService

router = APIRouter()
logger = logging.getLogger(__name__)


def get_group_service(db: Session = Depends(get_db)) -> GroupService:
    """Dependency to get GroupService instance"""
    return GroupService(db)


def get_group_name_by_id(group_id: int, db: Session) -> str:
    """Helper function to get group name by ID"""
    from app.models.group import Group
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    return group.name


# Group Management APIs
@router.get("", response_model=GroupListResponse)
async def list_groups(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
):
    """Get list of groups where current user is a member"""
    items, total = group_service.list_user_groups(
        user_id=current_user.id, skip=skip, limit=limit
    )
    return GroupListResponse(total=total, items=items)


@router.post("", response_model=GroupDetail, status_code=status.HTTP_201_CREATED)
async def create_group(
    group_create: GroupCreate,
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
):
    """Create a new group (creator becomes Owner)"""
    group = group_service.create_group(
        group_create=group_create, owner_user_id=current_user.id
    )
    return group_service.get_group_detail(group.name, current_user.id)


@router.get("/{group_id}", response_model=GroupDetail)
async def get_group(
    group_id: int,
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
    db: Session = Depends(get_db),
):
    """Get group detail"""
    group_name = get_group_name_by_id(group_id, db)

    return group_service.get_group_detail(group_name, current_user.id)


@router.put("/{group_id}", response_model=GroupDetail)
async def update_group(
    group_id: int,
    group_update: GroupUpdate,
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
    db: Session = Depends(get_db),
):
    """Update group information (Maintainer+ permission required)"""
    group_name = get_group_name_by_id(group_id, db)

    group_service.update_group(group_name, current_user.id, group_update)
    return group_service.get_group_detail(group_name, current_user.id)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: int,
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
    db: Session = Depends(get_db),
):
    """Delete a group (Owner only, must have no subgroups or resources)"""
    group_name = get_group_name_by_id(group_id, db)

    group_service.delete_group(group_name, current_user.id)
    return None


# Group Member Management APIs
@router.get("/{group_id}/members", response_model=GroupMemberListResponse)
async def list_group_members(
    group_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
    db: Session = Depends(get_db),
):
    """Get list of group members"""
    group_name = get_group_name_by_id(group_id, db)

    items, total = group_service.list_group_members(
        group_name=group_name, user_id=current_user.id, skip=skip, limit=limit
    )
    return GroupMemberListResponse(total=total, items=items)


@router.post("/{group_id}/members", status_code=status.HTTP_201_CREATED)
async def invite_member(
    group_id: int,
    invite: GroupMemberInvite,
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
    db: Session = Depends(get_db),
):
    """Invite a user to the group (Maintainer+ permission required)"""
    group_name = get_group_name_by_id(group_id, db)

    member = group_service.invite_member(group_name, current_user.id, invite)
    return {"message": "Member invited successfully", "member_id": member.id}


@router.put("/{group_id}/members/{user_id}")
async def update_member_role(
    group_id: int,
    user_id: int,
    update: GroupMemberUpdate,
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
    db: Session = Depends(get_db),
):
    """Update member role (Maintainer+ permission required)"""
    # Get group name by ID
    group_name = get_group_name_by_id(group_id, db)
    
    member = group_service.update_member_role(
        group_name, current_user.id, user_id, update
    )
    return {"message": "Member role updated successfully", "member_id": member.id}


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    group_id: int,
    user_id: int,
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
    db: Session = Depends(get_db),
):
    """Remove a member from the group (Maintainer+ permission required)"""
    group_name = get_group_name_by_id(group_id, db)

    group_service.remove_member(group_name, current_user.id, user_id)
    return None


@router.post("/{group_id}/members/invite-all")
async def invite_all_users(
    group_id: int,
    request: InviteAllUsersRequest,
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
    db: Session = Depends(get_db),
):
    """Invite all system users to the group with default Reporter role (Owner only)"""
    group_name = get_group_name_by_id(group_id, db)

    count = group_service.invite_all_users(group_name, current_user.id, request.role)
    return {"message": f"Successfully invited {count} users", "count": count}


@router.post("/{group_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_group(
    group_id: int,
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
    db: Session = Depends(get_db),
):
    """Leave a group (not available for Owner, must transfer ownership first)"""
    group_name = get_group_name_by_id(group_id, db)

    group_service.leave_group(group_name, current_user.id)
    return None


@router.post("/{group_id}/transfer-ownership", status_code=status.HTTP_200_OK)
async def transfer_ownership(
    group_id: int,
    request: TransferOwnershipRequest,
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
    db: Session = Depends(get_db),
):
    """Transfer group ownership to another Maintainer (Owner only)"""
    group_name = get_group_name_by_id(group_id, db)

    group_service.transfer_ownership(
        group_name, current_user.id, request.new_owner_user_id
    )
    return {"message": "Ownership transferred successfully"}


