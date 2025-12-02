# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

"""
Group API endpoints
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.core import security
from app.models.user import User
from app.schemas.group import (
    GroupCreate,
    GroupDetail,
    GroupListItem,
    GroupListResponse,
    GroupMemberInvite,
    GroupMemberListItem,
    GroupMemberListResponse,
    GroupMemberUpdate,
    GroupRole,
    GroupUpdate,
    InviteAllUsersRequest,
    TransferOwnershipRequest,
)
from app.services.group_service import GroupService

router = APIRouter()


def get_group_service(db: Session = Depends(get_db)) -> GroupService:
    """Dependency to get GroupService instance"""
    return GroupService(db)


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
    return group_service.get_group_detail(group.id, current_user.id)


@router.get("/{group_id}", response_model=GroupDetail)
async def get_group(
    group_id: int,
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
):
    """Get group detail"""
    return group_service.get_group_detail(group_id, current_user.id)


@router.put("/{group_id}", response_model=GroupDetail)
async def update_group(
    group_id: int,
    group_update: GroupUpdate,
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
):
    """Update group information (Maintainer+ permission required)"""
    group_service.update_group(group_id, current_user.id, group_update)
    return group_service.get_group_detail(group_id, current_user.id)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: int,
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
):
    """Delete a group (Owner only, must have no subgroups or resources)"""
    group_service.delete_group(group_id, current_user.id)
    return None


# Group Member Management APIs
@router.get("/{group_id}/members", response_model=GroupMemberListResponse)
async def list_group_members(
    group_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
):
    """Get list of group members"""
    items, total = group_service.list_group_members(
        group_id=group_id, user_id=current_user.id, skip=skip, limit=limit
    )
    return GroupMemberListResponse(total=total, items=items)


@router.post("/{group_id}/members", status_code=status.HTTP_201_CREATED)
async def invite_member(
    group_id: int,
    invite: GroupMemberInvite,
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
):
    """Invite a user to the group (Maintainer+ permission required)"""
    member = group_service.invite_member(group_id, current_user.id, invite)
    return {"message": "Member invited successfully", "member_id": member.id}


@router.put("/{group_id}/members/{user_id}")
async def update_member_role(
    group_id: int,
    user_id: int,
    update: GroupMemberUpdate,
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
):
    """Update member role (Maintainer+ permission required)"""
    member = group_service.update_member_role(
        group_id, current_user.id, user_id, update
    )
    return {"message": "Member role updated successfully", "member_id": member.id}


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    group_id: int,
    user_id: int,
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
):
    """Remove a member from the group (Maintainer+ permission required)"""
    group_service.remove_member(group_id, current_user.id, user_id)
    return None


@router.post("/{group_id}/members/invite-all")
async def invite_all_users(
    group_id: int,
    request: InviteAllUsersRequest,
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
):
    """Invite all system users to the group with default Reporter role (Owner only)"""
    count = group_service.invite_all_users(group_id, current_user.id, request.role)
    return {"message": f"Successfully invited {count} users", "count": count}


@router.post("/{group_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_group(
    group_id: int,
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
):
    """Leave a group (not available for Owner, must transfer ownership first)"""
    group_service.leave_group(group_id, current_user.id)
    return None


@router.post("/{group_id}/transfer-ownership", status_code=status.HTTP_200_OK)
async def transfer_ownership(
    group_id: int,
    request: TransferOwnershipRequest,
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
):
    """Transfer group ownership to another Maintainer (Owner only)"""
    group_service.transfer_ownership(
        group_id, current_user.id, request.new_owner_user_id
    )
    return {"message": "Ownership transferred successfully"}


# Group Resource APIs
@router.get("/{group_id}/models")
async def list_group_models(
    group_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
    group_service: GroupService = Depends(get_group_service),
):
    """Get models in this group (Reporter+ permission required)"""
    # Check view permission
    has_perm, _ = group_service.check_permission(group_id, current_user.id, "view")
    if not has_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to view group resources"
        )

    # Import here to avoid circular import
    from app.models.kind import Kind

    # Query models in this group
    query = db.query(Kind).filter(
        Kind.group_id == group_id,
        Kind.kind == "Model",
        Kind.is_active == True
    )

    total = query.count()
    models = query.offset(skip).limit(limit).all()

    return {
        "total": total,
        "items": [
            {
                "id": m.id,
                "name": m.name,
                "namespace": m.namespace,
                "json": m.json,
                "created_at": m.created_at,
                "updated_at": m.updated_at,
            }
            for m in models
        ],
    }


@router.get("/{group_id}/bots")
async def list_group_bots(
    group_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
    group_service: GroupService = Depends(get_group_service),
):
    """Get bots in this group (Reporter+ permission required)"""
    # Check view permission
    has_perm, _ = group_service.check_permission(group_id, current_user.id, "view")
    if not has_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to view group resources"
        )

    from app.models.kind import Kind

    # Query bots in this group
    query = db.query(Kind).filter(
        Kind.group_id == group_id,
        Kind.kind == "Bot",
        Kind.is_active == True
    )

    total = query.count()
    bots = query.offset(skip).limit(limit).all()

    return {
        "total": total,
        "items": [
            {
                "id": b.id,
                "name": b.name,
                "namespace": b.namespace,
                "json": b.json,
                "created_at": b.created_at,
                "updated_at": b.updated_at,
            }
            for b in bots
        ],
    }


@router.get("/{group_id}/teams")
async def list_group_teams(
    group_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
    group_service: GroupService = Depends(get_group_service),
):
    """Get teams in this group (Reporter+ permission required)"""
    # Check view permission
    has_perm, _ = group_service.check_permission(group_id, current_user.id, "view")
    if not has_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to view group resources"
        )

    from app.models.kind import Kind

    # Query teams in this group
    query = db.query(Kind).filter(
        Kind.group_id == group_id,
        Kind.kind == "Team",
        Kind.is_active == True
    )

    total = query.count()
    teams = query.offset(skip).limit(limit).all()

    return {
        "total": total,
        "items": [
            {
                "id": t.id,
                "name": t.name,
                "namespace": t.namespace,
                "json": t.json,
                "created_at": t.created_at,
                "updated_at": t.updated_at,
            }
            for t in teams
        ],
    }
