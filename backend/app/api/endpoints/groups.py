# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

"""
Group API endpoints
"""
import logging
from typing import Any, Dict, List, Optional

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
from app.services.model_aggregation_service import model_aggregation_service

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
    has_perm, _ = group_service.check_permission(group_name, current_user.id, "view")
    if not has_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to view group resources"
        )

    # Import here to avoid circular import
    from app.models.kind import Kind

    # Query models in this group
    query = db.query(Kind).filter(
        Kind.namespace == group_name,
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


@router.get("/{group_id}/bots/{bot_id}")
async def get_group_bot(
    group_id: int,
    bot_id: int,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
    group_service: GroupService = Depends(get_group_service),
):
    """Get a bot detail in the specified group"""
    group_name = get_group_name_by_id(group_id, db)
    
    # Check view permission
    has_perm, _ = group_service.check_permission(group_name, current_user.id, "view")
    if not has_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to view resources in this group"
        )
    
    from app.models.kind import Kind
    
    # Find the bot in this group
    bot = (
        db.query(Kind)
        .filter(
            Kind.id == bot_id,
            Kind.namespace == group_name,
            Kind.kind == "Bot",
            Kind.is_active == True,
        )
        .first()
    )
    
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bot with id '{bot_id}' not found in this group"
        )
    
    # Get bot components directly for group context
    from app.services.adapters import bot_kinds_service
    ghost, shell, model = bot_kinds_service._get_bot_components(db, bot, bot.user_id)
    
    # Convert to bot dict with proper context
    bot_dict = bot_kinds_service._convert_to_bot_dict(bot, ghost, shell, model)
    
    return bot_dict


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
    has_perm, _ = group_service.check_permission(group_name, current_user.id, "view")
    if not has_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to view group resources"
        )

    from app.models.kind import Kind
    from app.services.adapters import bot_kinds_service

    # Query bots in this group
    query = db.query(Kind).filter(
        Kind.namespace == group_name,
        Kind.kind == "Bot",
        Kind.is_active == True
    )

    total = query.count()
    bots = query.offset(skip).limit(limit).all()

    # Convert to full bot dicts with components
    bot_dicts = []
    for bot in bots:
        try:
            bot_dict = bot_kinds_service.get_by_id_and_user(db, bot_id=bot.id, user_id=bot.user_id)
            bot_dicts.append(bot_dict)
        except Exception as e:
            logger.error(f"Error converting bot {bot.id}: {str(e)}")
            continue

    return {
        "total": total,
        "items": bot_dicts,
    }


@router.post("/{group_id}/bots", status_code=status.HTTP_201_CREATED)
async def create_group_bot(
    group_id: int,
    bot_data: Dict[str, Any],
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
):
    """
    group_name = get_group_name_by_id(group_id, db)
    
    Create a new bot in the specified group (Developer+ permission required)
    """
    try:
        bot = group_service.create_group_bot(group_name, current_user.id, bot_data)
        logger.info(
            f"Created group Bot resource: name='{bot['name']}', "
            f"namespace='{bot.get('namespace', 'default')}', group_id={group_id}, "
            f"user_id={current_user.id}, resource_id={bot['id']}"
        )
        return {
            "message": "Group bot created successfully",
            "bot": bot,  # Return the complete bot dict from service
            "resource_id": bot["id"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating group bot: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create group bot"
        )


@router.put("/{group_id}/bots/{bot_id}", status_code=status.HTTP_200_OK)
async def update_group_bot(
    group_id: int,
    bot_id: int,
    bot_data: Dict[str, Any],
    current_user: User = Depends(security.get_current_user),
    group_service: GroupService = Depends(get_group_service),
):
    """
    Update a bot in the specified group (Developer+ permission required)
    """
    group_name = get_group_name_by_id(group_id, db)
    
    try:
        bot = group_service.update_group_bot(group_name, current_user.id, bot_id, bot_data)
        logger.info(
            f"Updated group Bot resource: id='{bot_id}', "
            f"group_id={group_id}, user_id={current_user.id}, resource_id={bot['id']}"
        )
        return {
            "message": "Group bot updated successfully",
            "bot": bot,  # Return the complete bot dict from service
            "resource_id": bot["id"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating group bot: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update group bot"
        )


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
    has_perm, _ = group_service.check_permission(group_name, current_user.id, "view")
    if not has_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to view group resources"
        )

    from app.models.kind import Kind

    # Query teams in this group
    query = db.query(Kind).filter(
        Kind.namespace == group_name,
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


@router.post("/{group_id}/models", status_code=status.HTTP_201_CREATED)
async def create_group_model(
    group_id: int,
    model_data: Dict[str, Any],
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
    group_service: GroupService = Depends(get_group_service),
):
    """
    group_name = get_group_name_by_id(group_id, db)
    
    Create a new model in the specified group (Developer+ permission required)
    """
    # Check if user has create permission in the group
    has_perm, _ = group_service.check_permission(group_name, current_user.id, "create")
    if not has_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to create resources in this group"
        )
    
    # Import here to avoid circular import
    from app.models.kind import Kind
    from app.services.kind_impl import ModelKindService
    
    try:
        # Validate the model data structure
        from app.schemas.kind import Model
        model_crd = Model.model_validate(model_data)
        
        # Check if model already exists in this group
        existing = (
            db.query(Kind)
            .filter(
                Kind.namespace == group_name,
                Kind.kind == "Model",
                Kind.namespace == model_data["metadata"]["namespace"],
                Kind.name == model_data["metadata"]["name"],
                Kind.is_active == True,
            )
            .first()
        )
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Model '{model_data['metadata']['name']}' already exists in this group"
            )
        
        # Create ModelKindService instance for data processing
        model_service = ModelKindService()
        
        # Extract and process resource data (including API key encryption)
        resource_data = model_service._extract_resource_data(model_data)
        
        # Create new group model
        db_resource = Kind(
            user_id=current_user.id,  # Creator user ID
            group_name=group_name,        # Group ownership
            kind="Model",
            name=model_data["metadata"]["name"],
            namespace=model_data["metadata"]["namespace"],
            json=resource_data,
        )
        
        db.add(db_resource)
        db.commit()
        db.refresh(db_resource)
        
        logger.info(
            f"Created group Model resource: name='{model_data['metadata']['name']}', "
            f"namespace='{model_data['metadata']['namespace']}', group_id={group_id}, "
            f"user_id={current_user.id}, resource_id={db_resource.id}"
        )
        
        # Format response using ModelKindService
        formatted_resource = model_service._format_resource(db_resource)
        
        return {
            "message": "Group model created successfully",
            "model": formatted_resource,
            "resource_id": db_resource.id
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid model data: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error creating group model: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create group model"
        )


@router.get("/{group_id}/models/unified")
async def get_group_unified_models(
    group_id: int,
    shell_type: Optional[str] = Query(None, description="Filter models compatible with shell type"),
    include_config: bool = Query(False, description="Include full model configuration"),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
    group_service: GroupService = Depends(get_group_service),
) -> Dict[str, Any]:
    """
    Get unified models available to a group.
    
    Returns models in the following priority order:
    1. Group-specific models (group_id = group_id)
    2. Public models (user_id = 0, group_id = null)
    
    Note: Personal user models are NOT included in group context.
    """
    # Check if user has access to the group
    has_perm, _ = group_service.check_permission(group_name, current_user.id, "view")
    if not has_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to view group resources"
        )
    
    # Delegate to service layer
    models = model_aggregation_service.list_group_available_models(
        db=db,
        group_name=group_name,
        current_user=current_user,
        shell_type=shell_type,
        include_config=include_config,
    )
    
    return {"data": models}


@router.put("/{group_id}/models/{model_id}", status_code=status.HTTP_200_OK)
async def update_group_model(
    group_id: int,
    model_id: str,
    model_data: Dict[str, Any],
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
    group_service: GroupService = Depends(get_group_service),
):
    """
    Update a model in the specified group (Developer+ permission required)
    """
    group_name = get_group_name_by_id(group_id, db)
    
    # Check if user has edit permission in the group
    has_perm, _ = group_service.check_permission(group_name, current_user.id, "edit")
    if not has_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to edit resources in this group"
        )
    
    # Import here to avoid circular import
    from app.models.kind import Kind
    from app.services.kind_impl import ModelKindService
    
    try:
        # Validate the model data structure
        from app.schemas.kind import Model
        model_crd = Model.model_validate(model_data)
        
        # Find the existing model in this group
        existing = (
            db.query(Kind)
            .filter(
                Kind.namespace == group_name,
                Kind.kind == "Model",
                Kind.name == model_id,
                Kind.is_active == True,
            )
            .first()
        )
        
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Model '{model_id}' not found in this group"
            )
        
        # Create ModelKindService instance for data processing
        model_service = ModelKindService()
        
        # Extract and process resource data (including API key encryption)
        resource_data = model_service._extract_resource_data(model_data)
        
        # Update the existing model
        existing.json = resource_data
        existing.namespace = model_data["metadata"]["namespace"]
        # Note: name and group_id should not be changed
        
        db.commit()
        db.refresh(existing)
        
        logger.info(
            f"Updated group Model resource: name='{model_id}', "
            f"group_id={group_id}, user_id={current_user.id}, resource_id={existing.id}"
        )
        
        # Format response using ModelKindService
        formatted_resource = model_service._format_resource(existing)
        
        return {
            "message": "Group model updated successfully",
            "model": formatted_resource,
            "resource_id": existing.id
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid model data: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error updating group model: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update group model"
        )


@router.delete("/{group_id}/models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group_model(
    group_id: int,
    model_id: str,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
    group_service: GroupService = Depends(get_group_service),
):
    """
    Delete a model from the specified group (Maintainer+ permission required)
    """
    group_name = get_group_name_by_id(group_id, db)
    
    # Check if user has delete permission in the group
    has_perm, _ = group_service.check_permission(group_name, current_user.id, "delete")
    if not has_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to delete resources in this group"
        )
    
    # Import here to avoid circular import
    from app.models.kind import Kind
    
    try:
        # Find the existing model in this group
        existing = (
            db.query(Kind)
            .filter(
                Kind.namespace == group_name,
                Kind.kind == "Model",
                Kind.name == model_id,
                Kind.is_active == True,
            )
            .first()
        )
        
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Model '{model_id}' not found in this group"
            )
        
        # Soft delete by setting is_active to False
        existing.is_active = False
        
        db.commit()
        
        logger.info(
            f"Deleted group Model resource: name='{model_id}', "
            f"group_id={group_id}, user_id={current_user.id}, resource_id={existing.id}"
        )
        
        return None
        
    except Exception as e:
        logger.error(f"Error deleting group model: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete group model"
        )


# Group Shell APIs
@router.get("/{group_id}/shells")
async def list_group_shells(
    group_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
    group_service: GroupService = Depends(get_group_service),
):
    """Get shells in this group (Reporter+ permission required)"""
    # Check view permission
    has_perm, _ = group_service.check_permission(group_name, current_user.id, "view")
    if not has_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to view group resources"
        )

    from app.models.kind import Kind

    # Query shells in this group
    query = db.query(Kind).filter(
        Kind.namespace == group_name,
        Kind.kind == "Shell",
        Kind.is_active == True
    )

    total = query.count()
    shells = query.offset(skip).limit(limit).all()

    return {
        "total": total,
        "items": [
            {
                "id": s.id,
                "name": s.name,
                "namespace": s.namespace,
                "json": s.json,
                "created_at": s.created_at,
                "updated_at": s.updated_at,
            }
            for s in shells
        ],
    }


@router.get("/{group_id}/shells/unified")
async def get_group_unified_shells(
    group_id: int,
    include_config: bool = Query(False, description="Include full shell configuration"),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
    group_service: GroupService = Depends(get_group_service),
) -> Dict[str, Any]:
    """
    group_name = get_group_name_by_id(group_id, db)
    
    Get unified shells available to a group.
    
    Returns shells in the following priority order:
    1. Group-specific shells (group_id = group_id)
    2. Public shells (user_id = 0, group_id = null)
    
    Note: Personal user shells are NOT included in group context.
    """
    # Check if user has access to the group
    has_perm, _ = group_service.check_permission(group_name, current_user.id, "view")
    if not has_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to view group resources"
        )
    
    from app.models.kind import Kind
    
    # Get group shells
    group_shells = (
        db.query(Kind)
        .filter(
            Kind.namespace == group_name,
            Kind.kind == "Shell",
            Kind.is_active == True
        )
        .all()
    )
    
    # Get public shells (user_id=0 indicates public resources)
    public_shells = (
        db.query(Kind)
        .filter(
            Kind.user_id == 0,
            Kind.group_id.is_(None),
            Kind.kind == "Shell",
            Kind.is_active == True
        )
        .all()
    )
    
    unified_shells = []
    
    # Add group shells
    for shell in group_shells:
        shell_data = shell.json or {}
        metadata = shell_data.get("metadata", {})
        spec = shell_data.get("spec", {})
        labels = metadata.get("labels", {})
        
        unified_shells.append({
            "name": shell.name,
            "type": "user",  # In group context, group shells are marked as 'user' type
            "displayName": metadata.get("displayName") or shell.name,
            "shellType": spec.get("shellType", shell.name),  # Fallback to shell name
            "baseImage": spec.get("baseImage"),
            "baseShellRef": spec.get("baseShellRef"),
            "executionType": labels.get("type") or spec.get("executionType"),
            "creatorUserId": shell.user_id,
        })
    
    # Add public shells
    for shell in public_shells:
        shell_data = shell.json or {}
        metadata = shell_data.get("metadata", {})
        spec = shell_data.get("spec", {})
        labels = metadata.get("labels", {})
        
        unified_shells.append({
            "name": shell.name,
            "type": "public",
            "displayName": metadata.get("displayName") or shell.name,
            "shellType": spec.get("shellType", shell.name),  # Fallback to shell name
            "baseImage": spec.get("baseImage"),
            "baseShellRef": spec.get("baseShellRef"),
            "executionType": labels.get("type") or spec.get("executionType"),
        })
    
    return {"data": unified_shells}


@router.post("/{group_id}/shells", status_code=status.HTTP_201_CREATED)
async def create_group_shell(
    group_id: int,
    shell_data: Dict[str, Any],
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
    group_service: GroupService = Depends(get_group_service),
):
    """
    Create a new shell in the specified group (Developer+ permission required)
    """
    group_name = get_group_name_by_id(group_id, db)
    
    # Check if user has create permission in the group
    has_perm, _ = group_service.check_permission(group_name, current_user.id, "create")
    if not has_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to create resources in this group"
        )
    
    from app.models.kind import Kind
    
    try:
        # Check if shell already exists in this group
        existing = (
            db.query(Kind)
            .filter(
                Kind.namespace == group_name,
                Kind.kind == "Shell",
                Kind.namespace == shell_data["metadata"]["namespace"],
                Kind.name == shell_data["metadata"]["name"],
                Kind.is_active == True,
            )
            .first()
        )
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Shell '{shell_data['metadata']['name']}' already exists in this group"
            )
        
        # Create new group shell
        db_resource = Kind(
            user_id=current_user.id,  # Creator user ID
            group_name=group_name,        # Group ownership
            kind="Shell",
            name=shell_data["metadata"]["name"],
            namespace=shell_data["metadata"]["namespace"],
            json=shell_data,
        )
        
        db.add(db_resource)
        db.commit()
        db.refresh(db_resource)
        
        logger.info(
            f"Created group Shell resource: name='{shell_data['metadata']['name']}', "
            f"namespace='{shell_data['metadata']['namespace']}', group_id={group_id}, "
            f"user_id={current_user.id}, resource_id={db_resource.id}"
        )
        
        return {
            "message": "Group shell created successfully",
            "shell": shell_data,
            "resource_id": db_resource.id
        }
        
    except Exception as e:
        logger.error(f"Error creating group shell: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create group shell"
        )


@router.put("/{group_id}/shells/{shell_id}", status_code=status.HTTP_200_OK)
async def update_group_shell(
    group_id: int,
    shell_id: str,
    shell_data: Dict[str, Any],
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
    group_service: GroupService = Depends(get_group_service),
):
    """
    Update a shell in the specified group (Developer+ permission required)
    """
    group_name = get_group_name_by_id(group_id, db)
    
    # Check if user has edit permission in the group
    has_perm, _ = group_service.check_permission(group_name, current_user.id, "edit")
    if not has_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to edit resources in this group"
        )
    
    from app.models.kind import Kind
    
    try:
        # Find the existing shell in this group
        existing = (
            db.query(Kind)
            .filter(
                Kind.namespace == group_name,
                Kind.kind == "Shell",
                Kind.name == shell_id,
                Kind.is_active == True,
            )
            .first()
        )
        
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Shell '{shell_id}' not found in this group"
            )
        
        # Update the existing shell
        existing.json = shell_data
        existing.namespace = shell_data["metadata"]["namespace"]
        
        db.commit()
        db.refresh(existing)
        
        logger.info(
            f"Updated group Shell resource: name='{shell_id}', "
            f"group_id={group_id}, user_id={current_user.id}, resource_id={existing.id}"
        )
        
        return {
            "message": "Group shell updated successfully",
            "shell": shell_data,
            "resource_id": existing.id
        }
        
    except Exception as e:
        logger.error(f"Error updating group shell: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update group shell"
        )


@router.delete("/{group_id}/shells/{shell_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group_shell(
    group_id: int,
    shell_id: str,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
    group_service: GroupService = Depends(get_group_service),
):
    """
    Delete a shell from the specified group (Maintainer+ permission required)
    """
    group_name = get_group_name_by_id(group_id, db)
    
    # Check if user has delete permission in the group
    has_perm, _ = group_service.check_permission(group_name, current_user.id, "delete")
    if not has_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No permission to delete resources in this group"
        )
    
    from app.models.kind import Kind
    
    try:
        # Find the existing shell in this group
        existing = (
            db.query(Kind)
            .filter(
                Kind.namespace == group_name,
                Kind.kind == "Shell",
                Kind.name == shell_id,
                Kind.is_active == True,
            )
            .first()
        )
        
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Shell '{shell_id}' not found in this group"
            )
        
        # Soft delete by setting is_active to False
        existing.is_active = False
        
        db.commit()
        
        logger.info(
            f"Deleted group Shell resource: name='{shell_id}', "
            f"group_id={group_id}, user_id={current_user.id}, resource_id={existing.id}"
        )
        
        return None
        
    except Exception as e:
        logger.error(f"Error deleting group shell: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete group shell"
        )
