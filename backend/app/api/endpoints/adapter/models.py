# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.core import security
from app.models.kind import Kind
from app.models.user import User
from app.schemas.kind import Model as ModelCRD
from app.schemas.model import (
    ModelBulkCreateItem,
    ModelCreate,
    ModelDetail,
    ModelInDB,
    ModelListResponse,
    ModelUpdate,
)
from app.services.adapters import public_model_service
from app.services.model_aggregation_service import ModelType, model_aggregation_service
from app.services.scope_service import scope_service, ScopeType

# Import AI client libraries at module level for better type checking
import anthropic
import openai

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("", response_model=ModelListResponse)
def list_models(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(security.get_current_user),
):
    """
    Get Model list (paginated, active only)
    """
    skip = (page - 1) * limit
    items = public_model_service.get_models(
        db=db, skip=skip, limit=limit, current_user=current_user
    )
    total = public_model_service.count_active_models(db=db, current_user=current_user)

    return {"total": total, "items": items}


@router.get("/names")
def list_model_names(
    shell_type: str = Query(..., description="Shell type (Agno, ClaudeCode)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(security.get_current_user),
):
    """
    Get all active model names (legacy API, use /unified for new implementations)

    Response:
    {
      "data": [
        {"name": "string", "displayName": "string"}
      ]
    }
    """
    data = public_model_service.list_model_names(
        db=db, current_user=current_user, shell_type=shell_type
    )
    return {"data": data}


@router.get("/unified")
def list_unified_models(
    shell_type: Optional[str] = Query(
        None, description="Shell type to filter compatible models (Agno, ClaudeCode)"
    ),
    include_config: bool = Query(
        False, description="Whether to include full config in response"
    ),
    scope: Optional[str] = Query(None, description="Scope for resource query"),
    db: Session = Depends(get_db),
    current_user: User = Depends(security.get_current_user),
):
    """
    Get unified list of all available models (both public and user-defined).

    This endpoint aggregates models from:
    - Public models (type='public'): Shared across all users
    - User-defined models (type='user'): Private to the current user
    - Group models (type='group'): Shared within groups (when scope='all')

    Each model includes a 'type' field to identify its source, which is
    important for avoiding naming conflicts when binding models.

    Parameters:
    - shell_type: Optional shell type to filter compatible models
    - include_config: Whether to include full model config in response
    - scope: Scope for resource query ('default', 'all', or 'group:{name}')

    Response:
    {
      "data": [
        {
          "name": "model-name",
          "type": "public" | "user" | "group",
          "displayName": "Human Readable Name",
          "provider": "openai" | "claude",
          "modelId": "gpt-4"
        }
      ]
    }
    """
    data = model_aggregation_service.list_available_models(
        db=db,
        current_user=current_user,
        shell_type=shell_type,
        include_config=include_config,
        scope=scope,
    )
    return {"data": data}


@router.get("/unified/{model_name}")
def get_unified_model(
    model_name: str,
    model_type: Optional[str] = Query(
        None, description="Model type ('public', 'user', or 'group')"
    ),
    scope: Optional[str] = Query(None, description="Scope for resource query"),
    db: Session = Depends(get_db),
    current_user: User = Depends(security.get_current_user),
):
    """
    Get a specific model by name, optionally with type hint and scope.

    If model_type is not provided, it will try to find the model
    in the following order:
    1. User's own models (type='user')
    2. Public models (type='public')
    3. Group models (type='group', if scope is provided)

    Parameters:
    - model_name: Model name
    - model_type: Optional model type hint ('public', 'user', or 'group')
    - scope: Scope for resource query ('default', 'group:{name}')

    Response:
    {
      "name": "model-name",
      "type": "public" | "user" | "group",
      "displayName": "Human Readable Name",
      "provider": "openai" | "claude",
      "modelId": "gpt-4",
      "config": {...},
      "isActive": true
    }
    """
    # Parse and validate scope
    scope_info = scope_service.parse_scope(scope)

    # Validate that "all" scope is not allowed for get operations
    scope_service.validate_scope_for_operation(scope_info, "get")

    # If scope is group, validate user has access
    if scope_info.scope_type == ScopeType.GROUP and scope_info.group_name:
        scope_service.validate_group_access(
            db=db,
            group_name=scope_info.group_name,
            user_id=current_user.id,
            required_permission="view",
        )

    result = model_aggregation_service.resolve_model(
        db=db,
        current_user=current_user,
        name=model_name,
        model_type=model_type,
        scope=scope,
    )

    if not result:
        raise HTTPException(status_code=404, detail="Model not found")

    return result


@router.post("", response_model=ModelInDB, status_code=status.HTTP_201_CREATED)
def create_model(
    model_create: ModelCreate,
    scope: Optional[str] = Query(None, description="Scope for resource creation"),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create new Model

    Parameters:
    - scope: Scope for resource creation ('default' or 'group:{name}')
    """
    # Parse and validate scope
    scope_info = scope_service.parse_scope(scope)

    # Validate that "all" scope is not allowed for create operations
    scope_service.validate_scope_for_operation(scope_info, "create")

    # Determine namespace based on scope
    namespace = "default"
    user_id = current_user.id

    if scope_info.scope_type == ScopeType.GROUP and scope_info.group_name:
        # Validate user has create permission in the group
        scope_service.validate_group_access(
            db=db,
            group_name=scope_info.group_name,
            user_id=current_user.id,
            required_permission="create",
        )
        namespace = scope_info.group_name

    # Check for existing model with same name in the target namespace
    existed = (
        db.query(Kind)
        .filter(
            Kind.user_id == user_id,
            Kind.kind == "Model",
            Kind.name == model_create.name,
            Kind.namespace == namespace,
        )
        .first()
    )
    if existed:
        raise HTTPException(
            status_code=400,
            detail=f"Model name '{model_create.name}' already exists in namespace '{namespace}'"
        )

    # Create model in the appropriate namespace
    json_data = {
        "kind": "Model",
        "spec": {"modelConfig": model_create.config},
        "status": {"state": "Available"},
        "metadata": {"name": model_create.name, "namespace": namespace},
        "apiVersion": "agent.wecode.io/v1",
    }

    db_obj = Kind(
        user_id=user_id,
        kind="Model",
        name=model_create.name,
        namespace=namespace,
        json=json_data,
        is_active=model_create.is_active if model_create.is_active is not None else True,
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)

    # Convert to ModelInDB format
    model_data = {
        "id": db_obj.id,
        "name": db_obj.name,
        "config": json_data.get("spec", {}).get("modelConfig", {}),
        "is_active": db_obj.is_active,
        "created_at": db_obj.created_at,
        "updated_at": db_obj.updated_at,
    }
    return ModelInDB.model_validate(model_data)


@router.post("/batch", status_code=status.HTTP_201_CREATED)
def bulk_create_models(
    items: List[ModelBulkCreateItem],
    scope: Optional[str] = Query(None, description="Scope for resource creation"),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Bulk upsert Models (create if not exists, update if exists).

    Request body example:
    [
      {
        "name": "modelname",
        "env": {
          "model": "xx",
          "base_url": "xx",
          "model_id": "xx",
          "api_key": "xx"
        }
      }
    ]

    Response:
    {
      "created": [ModelInDB...],
      "updated": [ModelInDB...],
      "skipped": [{"name": "...", "reason": "..."}]
    }
    """
    # Parse and validate scope
    scope_info = scope_service.parse_scope(scope)

    # Validate that "all" scope is not allowed for create operations
    scope_service.validate_scope_for_operation(scope_info, "create")

    # Determine namespace based on scope
    namespace = "default"
    user_id = current_user.id

    if scope_info.scope_type == ScopeType.GROUP and scope_info.group_name:
        # Validate user has create permission in the group
        scope_service.validate_group_access(
            db=db,
            group_name=scope_info.group_name,
            user_id=current_user.id,
            required_permission="create",
        )
        namespace = scope_info.group_name

    created: List[Kind] = []
    updated: List[Kind] = []
    skipped: List[dict] = []

    for it in items:
        try:
            existed = (
                db.query(Kind)
                .filter(
                    Kind.user_id == user_id,
                    Kind.kind == "Model",
                    Kind.name == it.name,
                    Kind.namespace == namespace,
                )
                .first()
            )
            if existed:
                # Update existing model
                if isinstance(existed.json, dict):
                    model_crd = ModelCRD.model_validate(existed.json)
                    # Update env section
                    model_crd.spec.modelConfig["env"] = (
                        dict(it.env) if isinstance(it.env, dict) else {}
                    )
                    existed.json = model_crd.model_dump()
                else:
                    # Fallback for invalid JSON
                    json_data = {
                        "kind": "Model",
                        "spec": {
                            "modelConfig": {
                                "env": (
                                    dict(it.env)
                                    if isinstance(it.env, dict)
                                    else {}
                                )
                            }
                        },
                        "status": {"state": "Available"},
                        "metadata": {"name": it.name, "namespace": namespace},
                        "apiVersion": "agent.wecode.io/v1",
                    }
                    existed.json = json_data
                # Update is_active only if explicitly provided
                if getattr(it, "is_active", None) is not None:
                    existed.is_active = it.is_active

                db.add(existed)
                db.commit()
                db.refresh(existed)
                updated.append(existed)
            else:
                # Create new
                json_data = {
                    "kind": "Model",
                    "spec": {"modelConfig": {"env": it.env}},
                    "status": {"state": "Available"},
                    "metadata": {"name": it.name, "namespace": namespace},
                    "apiVersion": "agent.wecode.io/v1",
                }

                db_obj = Kind(
                    user_id=user_id,
                    kind="Model",
                    name=it.name,
                    namespace=namespace,
                    json=json_data,
                    is_active=getattr(it, "is_active", True),
                )
                db.add(db_obj)
                db.commit()
                db.refresh(db_obj)
                created.append(db_obj)
        except Exception as e:
            logger.warning(f"Failed to process model {it.name}: {e}")
            skipped.append({"name": it.name, "reason": str(e)})
            continue

    # Convert Kind objects to ModelInDB objects
    created_models = []
    for db_obj in created:
        model_data = {
            "id": db_obj.id,
            "name": db_obj.name,
            "config": db_obj.json.get("spec", {}).get("modelConfig", {}),
            "is_active": db_obj.is_active,
            "created_at": db_obj.created_at,
            "updated_at": db_obj.updated_at,
        }
        created_models.append(ModelInDB.model_validate(model_data))

    updated_models = []
    for db_obj in updated:
        model_data = {
            "id": db_obj.id,
            "name": db_obj.name,
            "config": db_obj.json.get("spec", {}).get("modelConfig", {}),
            "is_active": db_obj.is_active,
            "created_at": db_obj.created_at,
            "updated_at": db_obj.updated_at,
        }
        updated_models.append(ModelInDB.model_validate(model_data))

    return {
        "created": created_models,
        "updated": updated_models,
        "skipped": skipped,
    }


@router.get("/{model_id}", response_model=ModelDetail)
def get_model(
    model_id: int,
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get specified Model details
    """
    return public_model_service.get_by_id(
        db=db, model_id=model_id, current_user=current_user
    )


@router.put("/{model_id}", response_model=ModelInDB)
def update_model(
    model_id: int,
    model_update: ModelUpdate,
    scope: Optional[str] = Query(None, description="Scope for resource update"),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update Model information

    Parameters:
    - scope: Scope for resource update ('default' or 'group:{name}')
    """
    # Parse and validate scope
    scope_info = scope_service.parse_scope(scope)

    # Validate that "all" scope is not allowed for update operations
    scope_service.validate_scope_for_operation(scope_info, "update")

    # Get the model to check its namespace
    model = db.query(Kind).filter(
        Kind.id == model_id,
        Kind.kind == "Model",
        Kind.is_active == True,
    ).first()

    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    # Check permissions based on model's namespace
    if model.namespace != "default":
        # This is a group resource, validate group permission
        scope_service.validate_group_access(
            db=db,
            group_name=model.namespace,
            user_id=current_user.id,
            required_permission="edit",
        )
    elif model.user_id != current_user.id and model.user_id != 0:
        # Personal resource owned by another user
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to update this model"
        )

    # If scope is provided and it's a group scope, validate it matches the model's namespace
    if scope_info.scope_type == ScopeType.GROUP and scope_info.group_name:
        if model.namespace != scope_info.group_name:
            raise HTTPException(
                status_code=400,
                detail=f"Scope mismatch: model belongs to namespace '{model.namespace}', not '{scope_info.group_name}'"
            )

    # Update the model
    if isinstance(model.json, dict):
        model_crd = ModelCRD.model_validate(model.json)
        # Update config
        if model_update.config:
            model_crd.spec.modelConfig = model_update.config
        model.json = model_crd.model_dump()

    if model_update.is_active is not None:
        model.is_active = model_update.is_active

    db.add(model)
    db.commit()
    db.refresh(model)

    # Convert to ModelInDB format
    model_data = {
        "id": model.id,
        "name": model.name,
        "config": model.json.get("spec", {}).get("modelConfig", {}),
        "is_active": model.is_active,
        "created_at": model.created_at,
        "updated_at": model.updated_at,
    }
    return ModelInDB.model_validate(model_data)


@router.delete("/{model_id}")
def delete_model(
    model_id: int,
    scope: Optional[str] = Query(None, description="Scope for resource deletion"),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Soft delete Model (set is_active to False)

    Parameters:
    - scope: Scope for resource deletion ('default' or 'group:{name}')
    """
    # Parse and validate scope
    scope_info = scope_service.parse_scope(scope)

    # Validate that "all" scope is not allowed for delete operations
    scope_service.validate_scope_for_operation(scope_info, "delete")

    # Get the model to check its namespace
    model = db.query(Kind).filter(
        Kind.id == model_id,
        Kind.kind == "Model",
        Kind.is_active == True,
    ).first()

    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    # Check permissions based on model's namespace
    if model.namespace != "default":
        # This is a group resource, validate group permission
        scope_service.validate_group_access(
            db=db,
            group_name=model.namespace,
            user_id=current_user.id,
            required_permission="delete",
        )
    elif model.user_id != current_user.id and model.user_id != 0:
        # Personal resource owned by another user
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to delete this model"
        )

    # If scope is provided and it's a group scope, validate it matches the model's namespace
    if scope_info.scope_type == ScopeType.GROUP and scope_info.group_name:
        if model.namespace != scope_info.group_name:
            raise HTTPException(
                status_code=400,
                detail=f"Scope mismatch: model belongs to namespace '{model.namespace}', not '{scope_info.group_name}'"
            )

    # Soft delete
    model.is_active = False
    db.add(model)
    db.commit()

    return {"message": "Model deleted successfully"}


@router.post("/test-connection")
def test_model_connection(
    test_data: dict,
    current_user: User = Depends(security.get_current_user),
):
    """
    Test model connection

    Request body:
    {
      "provider_type": "openai" | "anthropic",
      "model_id": "gpt-4",
      "api_key": "sk-...",
      "base_url": "https://api.openai.com/v1"  // optional
    }

    Response:
    {
      "success": true | false,
      "message": "Connection successful" | "Error message"
    }
    """
    provider_type = test_data.get("provider_type")
    model_id = test_data.get("model_id")
    api_key = test_data.get("api_key")
    base_url = test_data.get("base_url")

    if not provider_type or not model_id or not api_key:
        return {
            "success": False,
            "message": "Missing required fields: provider_type, model_id, api_key",
        }

    try:
        if provider_type == "openai":
            client = openai.OpenAI(
                api_key=api_key, base_url=base_url or "https://api.openai.com/v1"
            )
            # Send minimal test request
            response = client.chat.completions.create(
                model=model_id,
                messages=[{"role": "user", "content": "hi"}],
                max_tokens=1,
            )
            return {"success": True, "message": f"Successfully connected to {model_id}"}

        elif provider_type == "anthropic":
            # Create client with base_url in constructor for proper initialization
            # This is required for compatible APIs like MiniMax
            client_kwargs = {"auth_token": api_key}
            if base_url:
                client_kwargs["base_url"] = base_url

            client = anthropic.Anthropic(**client_kwargs)

            response = client.messages.create(
                model=model_id,
                max_tokens=1,
                messages=[{"role": "user", "content": "hi"}],
            )
            return {"success": True, "message": f"Successfully connected to {model_id}"}

        elif provider_type == "gemini":
            import httpx

            # Gemini uses REST API with API key in header
            gemini_base_url = base_url or "https://generativelanguage.googleapis.com"
            gemini_base_url = gemini_base_url.rstrip("/")

            # Build URL for generateContent endpoint
            if "/v1beta" in gemini_base_url or "/v1" in gemini_base_url:
                url = f"{gemini_base_url}/models/{model_id}:generateContent"
            else:
                url = f"{gemini_base_url}/v1beta/models/{model_id}:generateContent"

            headers = {
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            }

            payload = {
                "contents": [{"role": "user", "parts": [{"text": "hi"}]}],
                "generationConfig": {"maxOutputTokens": 1},
            }

            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, json=payload, headers=headers)
                response.raise_for_status()

            return {"success": True, "message": f"Successfully connected to {model_id}"}

        else:
            return {"success": False, "message": "Unsupported provider type"}

    except Exception as e:
        logger.error(f"Model connection test failed: {str(e)}")
        return {"success": False, "message": f"Connection failed: {str(e)}"}


@router.get("/compatible")
def get_compatible_models(
    shell_type: str = Query(..., description="Shell type (Agno or ClaudeCode)"),
    current_user: User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get models compatible with a specific shell type

    Parameters:
    - shell_type: "Agno" or "ClaudeCode"

    Response:
    {
      "models": [
        {"name": "my-gpt4-model"},
        {"name": "my-gpt4o-model"}
      ]
    }
    """
    # Query all active Model CRDs from kinds table
    models = (
        db.query(Kind)
        .filter(
            Kind.user_id == current_user.id,
            Kind.kind == "Model",
            Kind.namespace == "default",
            Kind.is_active == True,
        )
        .all()
    )

    compatible_models = []

    for model_kind in models:
        try:
            if not model_kind.json:
                continue
            model_crd = ModelCRD.model_validate(model_kind.json)
            model_config = model_crd.spec.modelConfig
            if isinstance(model_config, dict):
                env = model_config.get("env", {})
                model_type = env.get("model", "")

                # Filter compatible models
                # Agno supports both OpenAI and Claude models
                if shell_type == "Agno" and model_type in ["openai", "claude"]:
                    compatible_models.append({"name": model_kind.name})
                elif shell_type == "ClaudeCode" and model_type == "claude":
                    compatible_models.append({"name": model_kind.name})
        except Exception as e:
            logger.warning(f"Failed to parse model {model_kind.name}: {e}")
            continue

    return {"models": compatible_models}
