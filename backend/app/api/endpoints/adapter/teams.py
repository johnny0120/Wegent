# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.core import security
from app.models.kind import Kind
from app.models.user import User
from app.schemas.shared_team import (
    JoinSharedTeamRequest,
    JoinSharedTeamResponse,
    TeamShareRequest,
    TeamShareResponse,
)
from app.schemas.team import (
    TeamCreate,
    TeamDetail,
    TeamInDB,
    TeamListResponse,
    TeamUpdate,
)
from app.services.adapters.team_kinds import team_kinds_service
from app.services.shared_team import shared_team_service
from app.services.scope_service import scope_service, ScopeType

router = APIRouter()


@router.get("", response_model=TeamListResponse)
def list_teams(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    scope: Optional[str] = Query(None, description="Scope for resource query"),
    db: Session = Depends(get_db),
    current_user: User = Depends(security.get_current_user),
):
    """
    Get Teams list (paginated) based on scope.

    This endpoint returns teams from:
    - Personal teams (type='user'): Private to the current user
    - Group teams (type='group'): Shared within groups (when scope='all' or 'group:{name}')

    Parameters:
    - page: Page number
    - limit: Items per page
    - scope: Scope for resource query ('default', 'all', or 'group:{name}')
    """
    # Parse and validate scope
    scope_info = scope_service.parse_scope(scope)

    # Validate scope for list operation
    scope_service.validate_scope_for_operation(scope_info, "list")

    skip = (page - 1) * limit

    # Handle different scope types
    if scope_info.scope_type == ScopeType.DEFAULT:
        # Default: personal teams only (existing behavior)
        items = team_kinds_service.get_user_teams(
            db=db, user_id=current_user.id, skip=skip, limit=limit
        )
        if page == 1 and len(items) < limit:
            total = len(items)
        else:
            total = team_kinds_service.count_user_teams(db=db, user_id=current_user.id)

    elif scope_info.scope_type == ScopeType.ALL:
        # All: personal + all group teams user has access to
        items = []

        # Get personal teams
        personal_teams = team_kinds_service.get_user_teams(
            db=db, user_id=current_user.id, skip=0, limit=1000  # Get all personal teams
        )
        items.extend(personal_teams)

        # Get user's groups
        user_groups = scope_service.get_user_groups(db, current_user.id)

        if user_groups:
            # Get group teams
            group_teams_query = (
                db.query(Kind)
                .filter(
                    Kind.kind == "Team",
                    Kind.namespace.in_(user_groups),
                    Kind.is_active == True,
                )
                .order_by(Kind.created_at.desc())
                .all()
            )

            # Convert group teams to dict format and add groupName
            for team_kind in group_teams_query:
                team_dict = team_kinds_service._convert_to_team_dict(
                    team_kind, db, current_user.id
                )
                team_dict["groupName"] = team_kind.namespace
                team_dict["type"] = "group"
                items.append(team_dict)

        # Apply pagination to combined results
        total = len(items)
        items = items[skip : skip + limit]

    elif scope_info.scope_type == ScopeType.GROUP and scope_info.group_name:
        # Group: specific group teams only
        # Validate group access
        scope_service.validate_group_access(
            db=db,
            group_name=scope_info.group_name,
            user_id=current_user.id,
            required_permission="view",
        )

        # Get group teams
        group_teams = (
            db.query(Kind)
            .filter(
                Kind.kind == "Team",
                Kind.namespace == scope_info.group_name,
                Kind.is_active == True,
            )
            .order_by(Kind.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        items = []
        for team_kind in group_teams:
            team_dict = team_kinds_service._convert_to_team_dict(
                team_kind, db, current_user.id
            )
            team_dict["groupName"] = team_kind.namespace
            team_dict["type"] = "group"
            items.append(team_dict)

        # Get total count for group teams
        total = (
            db.query(Kind)
            .filter(
                Kind.kind == "Team",
                Kind.namespace == scope_info.group_name,
                Kind.is_active == True,
            )
            .count()
        )

    return {"total": total, "items": items}


@router.post("", response_model=TeamInDB, status_code=status.HTTP_201_CREATED)
def create_team(
    team_create: TeamCreate,
    scope: Optional[str] = Query(None, description="Scope for resource creation"),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create new Team.

    Parameters:
    - scope: Scope for resource creation ('default' or 'group:{name}')
    """
    # Parse and validate scope
    scope_info = scope_service.parse_scope(scope)

    # Validate that "all" scope is not allowed for create operations
    scope_service.validate_scope_for_operation(scope_info, "create")

    # Determine namespace based on scope
    namespace = "default"

    if scope_info.scope_type == ScopeType.GROUP and scope_info.group_name:
        # Validate user has create permission in the group
        scope_service.validate_group_access(
            db=db,
            group_name=scope_info.group_name,
            user_id=current_user.id,
            required_permission="create",
        )
        namespace = scope_info.group_name

        # Override namespace in team_create if not already set
        if not team_create.namespace or team_create.namespace == "default":
            team_create.namespace = namespace

    return team_kinds_service.create_with_user(
        db=db, obj_in=team_create, user_id=current_user.id
    )


@router.get("/{team_id}", response_model=TeamDetail)
def get_team(
    team_id: int,
    scope: Optional[str] = Query(None, description="Scope for resource query"),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get specified Team details with related user and bots.

    Parameters:
    - scope: Scope for resource query ('default' or 'group:{name}')
    """
    # Parse and validate scope
    scope_info = scope_service.parse_scope(scope)

    # Validate that "all" scope is not allowed for get operations
    scope_service.validate_scope_for_operation(scope_info, "get")

    # Get the team first to check its namespace
    team = db.query(Kind).filter(
        Kind.id == team_id,
        Kind.kind == "Team",
        Kind.is_active == True,
    ).first()

    if not team:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Team not found")

    # If scope is group, validate user has access
    if scope_info.scope_type == ScopeType.GROUP and scope_info.group_name:
        scope_service.validate_group_access(
            db=db,
            group_name=scope_info.group_name,
            user_id=current_user.id,
            required_permission="view",
        )

        # Validate that the team belongs to this group
        if team.namespace != scope_info.group_name:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=400,
                detail=f"Team belongs to namespace '{team.namespace}', not '{scope_info.group_name}'"
            )

    # Check permissions based on team's namespace
    if team.namespace != "default":
        # This is a group resource, validate group permission
        scope_service.validate_group_access(
            db=db,
            group_name=team.namespace,
            user_id=current_user.id,
            required_permission="view",
        )

    return team_kinds_service.get_team_detail(
        db=db, team_id=team_id, user_id=current_user.id
    )


@router.put("/{team_id}", response_model=TeamInDB)
def update_team(
    team_id: int,
    team_update: TeamUpdate,
    scope: Optional[str] = Query(None, description="Scope for resource update"),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update Team information.

    Parameters:
    - scope: Scope for resource update ('default' or 'group:{name}')
    """
    # Parse and validate scope
    scope_info = scope_service.parse_scope(scope)

    # Validate that "all" scope is not allowed for update operations
    scope_service.validate_scope_for_operation(scope_info, "update")

    # Get the team to check its namespace
    team = db.query(Kind).filter(
        Kind.id == team_id,
        Kind.kind == "Team",
        Kind.is_active == True,
    ).first()

    if not team:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Team not found")

    # Check permissions based on team's namespace
    if team.namespace != "default":
        # This is a group resource, validate group permission
        scope_service.validate_group_access(
            db=db,
            group_name=team.namespace,
            user_id=current_user.id,
            required_permission="edit",
        )
    elif team.user_id != current_user.id:
        # Personal resource owned by another user
        from fastapi import HTTPException
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to update this team"
        )

    # If scope is provided and it's a group scope, validate it matches the team's namespace
    if scope_info.scope_type == ScopeType.GROUP and scope_info.group_name:
        if team.namespace != scope_info.group_name:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=400,
                detail=f"Scope mismatch: team belongs to namespace '{team.namespace}', not '{scope_info.group_name}'"
            )

    return team_kinds_service.update_with_user(
        db=db, team_id=team_id, obj_in=team_update, user_id=current_user.id
    )


@router.delete("/{team_id}")
def delete_team(
    team_id: int,
    scope: Optional[str] = Query(None, description="Scope for resource deletion"),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete or deactivate Team.

    Parameters:
    - scope: Scope for resource deletion ('default' or 'group:{name}')
    """
    # Parse and validate scope
    scope_info = scope_service.parse_scope(scope)

    # Validate that "all" scope is not allowed for delete operations
    scope_service.validate_scope_for_operation(scope_info, "delete")

    # Get the team to check its namespace
    team = db.query(Kind).filter(
        Kind.id == team_id,
        Kind.kind == "Team",
        Kind.is_active == True,
    ).first()

    if not team:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Team not found")

    # Check permissions based on team's namespace
    if team.namespace != "default":
        # This is a group resource, validate group permission
        scope_service.validate_group_access(
            db=db,
            group_name=team.namespace,
            user_id=current_user.id,
            required_permission="delete",
        )
    elif team.user_id != current_user.id:
        # Personal resource owned by another user
        from fastapi import HTTPException
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to delete this team"
        )

    # If scope is provided and it's a group scope, validate it matches the team's namespace
    if scope_info.scope_type == ScopeType.GROUP and scope_info.group_name:
        if team.namespace != scope_info.group_name:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=400,
                detail=f"Scope mismatch: team belongs to namespace '{team.namespace}', not '{scope_info.group_name}'"
            )

    team_kinds_service.delete_with_user(db=db, team_id=team_id, user_id=current_user.id)
    return {"message": "Team deactivated successfully"}


@router.post("/{team_id}/share", response_model=TeamShareResponse)
def share_team(
    team_id: int,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """Generate team share link"""
    return shared_team_service.share_team(
        db=db,
        team_id=team_id,
        user_id=current_user.id,
    )


@router.get("/{team_id}/input-parameters")
def get_team_input_parameters(
    team_id: int,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """Get input parameters required by the team's external API bots"""
    return team_kinds_service.get_team_input_parameters(
        db=db, team_id=team_id, user_id=current_user.id
    )


@router.get("/share/info")
def get_share_info(
    share_token: str = Query(..., description="Share token"),
    db: Session = Depends(get_db),
):
    """Get team share information from token"""
    return shared_team_service.get_share_info(db=db, share_token=share_token)


@router.post("/share/join", response_model=JoinSharedTeamResponse)
def join_shared_team(
    request: JoinSharedTeamRequest,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """Join a shared team"""
    return shared_team_service.join_shared_team(
        db=db, share_token=request.share_token, user_id=current_user.id
    )
