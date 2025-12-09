# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.core import security
from app.models.kind import Kind
from app.models.user import User
from app.schemas.bot import BotCreate, BotDetail, BotInDB, BotListResponse, BotUpdate
from app.services.adapters import bot_kinds_service
from app.services.scope_service import scope_service, ScopeType

router = APIRouter()


@router.get("", response_model=BotListResponse)
def list_bots(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    scope: Optional[str] = Query(None, description="Scope for resource query"),
    db: Session = Depends(get_db),
    current_user: User = Depends(security.get_current_user),
):
    """
    Get Bots list (paginated) based on scope.

    This endpoint returns bots from:
    - Personal bots (type='user'): Private to the current user
    - Group bots (type='group'): Shared within groups (when scope='all' or 'group:{name}')

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
        # Default: personal bots only (existing behavior)
        bot_dicts = bot_kinds_service.get_user_bots(
            db=db, user_id=current_user.id, skip=skip, limit=limit
        )
        if page == 1 and len(bot_dicts) < limit:
            total = len(bot_dicts)
        else:
            total = bot_kinds_service.count_user_bots(db=db, user_id=current_user.id)
        items = bot_dicts

    elif scope_info.scope_type == ScopeType.ALL:
        # All: personal + all group bots user has access to
        items = []

        # Get personal bots
        personal_bots = bot_kinds_service.get_user_bots(
            db=db, user_id=current_user.id, skip=0, limit=1000  # Get all personal bots
        )
        items.extend(personal_bots)

        # Get user's groups
        user_groups = scope_service.get_user_groups(db, current_user.id)

        if user_groups:
            # Get group bots
            group_bots_query = (
                db.query(Kind)
                .filter(
                    Kind.kind == "Bot",
                    Kind.namespace.in_(user_groups),
                    Kind.is_active == True,
                )
                .order_by(Kind.created_at.desc())
                .all()
            )

            # Convert group bots to dict format and add groupName
            for bot_kind in group_bots_query:
                bot_dict = bot_kinds_service._kind_to_bot_dict(bot_kind, db, current_user.id)
                bot_dict["groupName"] = bot_kind.namespace
                bot_dict["type"] = "group"
                items.append(bot_dict)

        # Apply pagination to combined results
        total = len(items)
        items = items[skip : skip + limit]

    elif scope_info.scope_type == ScopeType.GROUP and scope_info.group_name:
        # Group: specific group bots only
        # Validate group access
        scope_service.validate_group_access(
            db=db,
            group_name=scope_info.group_name,
            user_id=current_user.id,
            required_permission="view",
        )

        # Get group bots
        group_bots = (
            db.query(Kind)
            .filter(
                Kind.kind == "Bot",
                Kind.namespace == scope_info.group_name,
                Kind.is_active == True,
            )
            .order_by(Kind.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        items = []
        for bot_kind in group_bots:
            bot_dict = bot_kinds_service._kind_to_bot_dict(bot_kind, db, current_user.id)
            bot_dict["groupName"] = bot_kind.namespace
            bot_dict["type"] = "group"
            items.append(bot_dict)

        # Get total count for group bots
        total = (
            db.query(Kind)
            .filter(
                Kind.kind == "Bot",
                Kind.namespace == scope_info.group_name,
                Kind.is_active == True,
            )
            .count()
        )

    return {"total": total, "items": items}


@router.post("", response_model=BotInDB, status_code=status.HTTP_201_CREATED)
def create_bot(
    bot_create: BotCreate,
    scope: Optional[str] = Query(None, description="Scope for resource creation"),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create new Bot.

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

        # Override namespace in bot_create if not already set
        if not bot_create.namespace or bot_create.namespace == "default":
            bot_create.namespace = namespace

    bot_dict = bot_kinds_service.create_with_user(
        db=db, obj_in=bot_create, user_id=current_user.id
    )
    return bot_dict


@router.get("/{bot_id}", response_model=BotDetail)
def get_bot(
    bot_id: int,
    scope: Optional[str] = Query(None, description="Scope for resource query"),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get specified Bot details with related user.

    Parameters:
    - scope: Scope for resource query ('default' or 'group:{name}')
    """
    # Parse and validate scope
    scope_info = scope_service.parse_scope(scope)

    # Validate that "all" scope is not allowed for get operations
    scope_service.validate_scope_for_operation(scope_info, "get")

    # Get the bot first to check its namespace
    bot = db.query(Kind).filter(
        Kind.id == bot_id,
        Kind.kind == "Bot",
        Kind.is_active == True,
    ).first()

    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    # If scope is group, validate user has access
    if scope_info.scope_type == ScopeType.GROUP and scope_info.group_name:
        scope_service.validate_group_access(
            db=db,
            group_name=scope_info.group_name,
            user_id=current_user.id,
            required_permission="view",
        )

        # Validate that the bot belongs to this group
        if bot.namespace != scope_info.group_name:
            raise HTTPException(
                status_code=400,
                detail=f"Bot belongs to namespace '{bot.namespace}', not '{scope_info.group_name}'"
            )

    # Check permissions based on bot's namespace
    if bot.namespace != "default":
        # This is a group resource, validate group permission
        scope_service.validate_group_access(
            db=db,
            group_name=bot.namespace,
            user_id=current_user.id,
            required_permission="view",
        )

    bot_dict = bot_kinds_service.get_bot_detail(
        db=db, bot_id=bot_id, user_id=current_user.id
    )
    return bot_dict


@router.put("/{bot_id}", response_model=BotInDB)
def update_bot(
    bot_id: int,
    bot_update: BotUpdate,
    scope: Optional[str] = Query(None, description="Scope for resource update"),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update Bot information.

    Parameters:
    - scope: Scope for resource update ('default' or 'group:{name}')
    """
    import logging

    logger = logging.getLogger(__name__)
    logger.info(f"[DEBUG] update_bot called with bot_id={bot_id}")
    logger.info(f"[DEBUG] bot_update raw: {bot_update}")
    logger.info(f"[DEBUG] bot_update.agent_config: {bot_update.agent_config}")
    logger.info(
        f"[DEBUG] bot_update.model_dump(exclude_unset=True): {bot_update.model_dump(exclude_unset=True)}"
    )

    # Parse and validate scope
    scope_info = scope_service.parse_scope(scope)

    # Validate that "all" scope is not allowed for update operations
    scope_service.validate_scope_for_operation(scope_info, "update")

    # Get the bot to check its namespace
    bot = db.query(Kind).filter(
        Kind.id == bot_id,
        Kind.kind == "Bot",
        Kind.is_active == True,
    ).first()

    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    # Check permissions based on bot's namespace
    if bot.namespace != "default":
        # This is a group resource, validate group permission
        scope_service.validate_group_access(
            db=db,
            group_name=bot.namespace,
            user_id=current_user.id,
            required_permission="edit",
        )
    elif bot.user_id != current_user.id:
        # Personal resource owned by another user
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to update this bot"
        )

    # If scope is provided and it's a group scope, validate it matches the bot's namespace
    if scope_info.scope_type == ScopeType.GROUP and scope_info.group_name:
        if bot.namespace != scope_info.group_name:
            raise HTTPException(
                status_code=400,
                detail=f"Scope mismatch: bot belongs to namespace '{bot.namespace}', not '{scope_info.group_name}'"
            )

    bot_dict = bot_kinds_service.update_with_user(
        db=db, bot_id=bot_id, obj_in=bot_update, user_id=current_user.id
    )
    return bot_dict


@router.delete("/{bot_id}")
def delete_bot(
    bot_id: int,
    scope: Optional[str] = Query(None, description="Scope for resource deletion"),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete Bot or deactivate if used in teams.

    Parameters:
    - scope: Scope for resource deletion ('default' or 'group:{name}')
    """
    # Parse and validate scope
    scope_info = scope_service.parse_scope(scope)

    # Validate that "all" scope is not allowed for delete operations
    scope_service.validate_scope_for_operation(scope_info, "delete")

    # Get the bot to check its namespace
    bot = db.query(Kind).filter(
        Kind.id == bot_id,
        Kind.kind == "Bot",
        Kind.is_active == True,
    ).first()

    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    # Check permissions based on bot's namespace
    if bot.namespace != "default":
        # This is a group resource, validate group permission
        scope_service.validate_group_access(
            db=db,
            group_name=bot.namespace,
            user_id=current_user.id,
            required_permission="delete",
        )
    elif bot.user_id != current_user.id:
        # Personal resource owned by another user
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to delete this bot"
        )

    # If scope is provided and it's a group scope, validate it matches the bot's namespace
    if scope_info.scope_type == ScopeType.GROUP and scope_info.group_name:
        if bot.namespace != scope_info.group_name:
            raise HTTPException(
                status_code=400,
                detail=f"Scope mismatch: bot belongs to namespace '{bot.namespace}', not '{scope_info.group_name}'"
            )

    bot_kinds_service.delete_with_user(db=db, bot_id=bot_id, user_id=current_user.id)
    return {"message": "Bot deleted successfully"}
