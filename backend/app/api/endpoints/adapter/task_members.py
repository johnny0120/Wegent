# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

"""
API endpoints for task members (group chat) management.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.core import security
from app.models.user import User
from app.schemas.task_invite import (
    InviteInfoResponse,
    InviteLinkResponse,
    JoinByInviteResponse,
)
from app.schemas.task_member import (
    AddMemberRequest,
    RemoveMemberResponse,
    TaskMemberListResponse,
    TaskMemberResponse,
)
from app.services.task_invite_service import task_invite_service
from app.services.task_member_service import task_member_service

router = APIRouter()
logger = logging.getLogger(__name__)


# ============ Member Management API ============


@router.get("/{task_id}/members", response_model=TaskMemberListResponse)
def get_task_members(
    task_id: int,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all active members of a task (group chat).
    User must be a member of the task to view members.
    """
    # Check if user is a member of the task
    if not task_member_service.is_member(db, task_id, current_user.id):
        raise HTTPException(
            status_code=403, detail="You are not a member of this group chat"
        )

    return task_member_service.get_members(db, task_id)


@router.post("/{task_id}/members", response_model=TaskMemberResponse)
def add_task_member(
    task_id: int,
    request: AddMemberRequest,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Manually add a user to a task (group chat).
    Any member can add new members.
    """
    # Check if current user is a member
    if not task_member_service.is_member(db, task_id, current_user.id):
        raise HTTPException(
            status_code=403, detail="You are not a member of this group chat"
        )

    # Check if target user exists
    target_user = task_member_service.get_user(db, request.user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if task is a group chat
    if not task_member_service.is_group_chat(db, task_id):
        raise HTTPException(
            status_code=400, detail="This task is not a group chat"
        )

    # Add member
    member = task_member_service.add_member(
        db=db,
        task_id=task_id,
        user_id=request.user_id,
        invited_by=current_user.id,
    )

    # Get user info for response
    inviter = task_member_service.get_user(db, current_user.id)

    return TaskMemberResponse(
        id=member.id,
        task_id=task_id,
        user_id=request.user_id,
        username=target_user.user_name,
        avatar=None,
        invited_by=current_user.id,
        inviter_name=inviter.user_name if inviter else "Unknown",
        status=member.status,
        joined_at=member.joined_at,
        is_owner=False,
    )


@router.delete("/{task_id}/members/{user_id}", response_model=RemoveMemberResponse)
def remove_task_member(
    task_id: int,
    user_id: int,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Remove a member from a task (group chat).
    Only the task owner can remove members.
    """
    # Only task owner can remove members
    if not task_member_service.is_task_owner(db, task_id, current_user.id):
        raise HTTPException(
            status_code=403, detail="Only the task owner can remove members"
        )

    task_member_service.remove_member(
        db=db,
        task_id=task_id,
        user_id=user_id,
        removed_by=current_user.id,
    )

    return RemoveMemberResponse(
        message="Member removed successfully",
        user_id=user_id,
    )


# ============ Invite Link API ============


@router.post("/{task_id}/invite-link", response_model=InviteLinkResponse)
def generate_invite_link(
    task_id: int,
    expires_hours: int = Query(default=72, ge=1, le=720),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate a group chat invite link.
    Any member can generate an invite link.
    Default expiration: 72 hours, max: 30 days (720 hours).
    """
    # Check if user is a member
    if not task_member_service.is_member(db, task_id, current_user.id):
        raise HTTPException(
            status_code=403, detail="You are not a member of this group chat"
        )

    # Check if task is a group chat
    if not task_member_service.is_group_chat(db, task_id):
        raise HTTPException(
            status_code=400, detail="This task is not a group chat"
        )

    # Generate invite token
    token = task_invite_service.generate_invite_token(
        task_id=task_id,
        inviter_id=current_user.id,
        expires_hours=expires_hours,
    )
    invite_url = task_invite_service.generate_invite_url(token)

    return InviteLinkResponse(
        invite_url=invite_url,
        invite_token=token,
        expires_hours=expires_hours,
    )


@router.get("/invite/info", response_model=InviteInfoResponse)
def get_invite_info(
    token: str = Query(..., description="Invite token from URL"),
    db: Session = Depends(get_db),
):
    """
    Get invite link information (no authentication required).
    Used to display the invite confirmation page.
    """
    invite_data = task_invite_service.decode_invite_token(token)
    if not invite_data:
        raise HTTPException(status_code=400, detail="Invalid invite link")

    if invite_data["is_expired"]:
        raise HTTPException(status_code=400, detail="Invite link has expired")

    task_id = invite_data["task_id"]
    inviter_id = invite_data["inviter_id"]

    # Get task and inviter info
    task = task_member_service.get_task(db, task_id)
    inviter = task_member_service.get_user(db, inviter_id)

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not inviter:
        raise HTTPException(status_code=404, detail="Inviter not found")

    # Get task title from JSON
    task_json = task.json if isinstance(task.json, dict) else {}
    spec = task_json.get("spec", {})
    task_title = spec.get("title", task.name or "Untitled")

    # Get team name
    team_name = task_member_service.get_team_name(db, task_id)

    # Get member count
    member_count = task_member_service.get_member_count(db, task_id)

    return InviteInfoResponse(
        task_id=task_id,
        task_title=task_title,
        inviter_id=inviter_id,
        inviter_name=inviter.user_name,
        team_name=team_name,
        member_count=member_count,
        expires_at=invite_data["expires_at"].isoformat(),
    )


@router.post("/invite/join", response_model=JoinByInviteResponse)
def join_by_invite(
    token: str = Query(..., description="Invite token"),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Join a group chat via invite link.
    Requires authentication.
    Automatically adds the user as a group chat member.
    """
    invite_data = task_invite_service.decode_invite_token(token)
    if not invite_data:
        raise HTTPException(status_code=400, detail="Invalid invite link")

    if invite_data["is_expired"]:
        raise HTTPException(status_code=400, detail="Invite link has expired")

    task_id = invite_data["task_id"]
    inviter_id = invite_data["inviter_id"]

    # Verify task exists and is a group chat
    task = task_member_service.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not task_member_service.is_group_chat(db, task_id):
        raise HTTPException(
            status_code=400, detail="This task is not a group chat"
        )

    # Check if already a member
    if task_member_service.is_member(db, task_id, current_user.id):
        return JoinByInviteResponse(
            message="You are already a member",
            task_id=task_id,
            already_member=True,
        )

    # Add as member
    task_member_service.add_member(
        db=db,
        task_id=task_id,
        user_id=current_user.id,
        invited_by=inviter_id,
    )

    return JoinByInviteResponse(
        message="Successfully joined the group chat",
        task_id=task_id,
        already_member=False,
    )
