# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

import logging
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.core import security
from app.models.kind import Kind
from app.models.public_shell import PublicShell
from app.models.user import User
from app.schemas.kind import Shell as ShellCRD

router = APIRouter()
logger = logging.getLogger(__name__)


# Request/Response Models
class UnifiedShell(BaseModel):
    """Unified shell representation for API responses"""

    name: str
    type: str  # 'public' or 'user'
    displayName: Optional[str] = None
    runtime: str
    baseImage: Optional[str] = None
    baseShellRef: Optional[str] = None
    supportModel: Optional[List[str]] = None
    shellType: Optional[str] = None  # 'local_engine' or 'external_api'


class ShellCreateRequest(BaseModel):
    """Request body for creating a user shell"""

    name: str
    displayName: Optional[str] = None
    baseShellRef: str  # Required: base public shell name (e.g., "ClaudeCode")
    baseImage: str  # Required: custom base image address


class ShellUpdateRequest(BaseModel):
    """Request body for updating a user shell"""

    displayName: Optional[str] = None
    baseImage: Optional[str] = None


class ImageValidationRequest(BaseModel):
    """Request body for validating base image compatibility"""

    image: str
    shellType: str  # e.g., "ClaudeCode", "Agno"


class ImageCheckResult(BaseModel):
    """Individual check result"""

    name: str
    version: Optional[str] = None
    status: str  # 'pass' or 'fail'
    message: Optional[str] = None


class ImageValidationResponse(BaseModel):
    """Response for image validation"""

    valid: bool
    checks: List[ImageCheckResult]
    errors: List[str]


def _public_shell_to_unified(shell: PublicShell) -> UnifiedShell:
    """Convert PublicShell to UnifiedShell"""
    shell_crd = ShellCRD.model_validate(shell.json)
    labels = shell_crd.metadata.labels or {}
    return UnifiedShell(
        name=shell.name,
        type="public",
        displayName=shell_crd.metadata.displayName or shell.name,
        runtime=shell_crd.spec.runtime,
        baseImage=shell_crd.spec.baseImage,
        baseShellRef=shell_crd.spec.baseShellRef,
        supportModel=shell_crd.spec.supportModel,
        shellType=labels.get("type"),
    )


def _user_shell_to_unified(kind: Kind) -> UnifiedShell:
    """Convert Kind (user shell) to UnifiedShell"""
    shell_crd = ShellCRD.model_validate(kind.json)
    labels = shell_crd.metadata.labels or {}
    return UnifiedShell(
        name=kind.name,
        type="user",
        displayName=shell_crd.metadata.displayName or kind.name,
        runtime=shell_crd.spec.runtime,
        baseImage=shell_crd.spec.baseImage,
        baseShellRef=shell_crd.spec.baseShellRef,
        supportModel=shell_crd.spec.supportModel,
        shellType=labels.get("type"),
    )


@router.get("/unified", response_model=dict)
def list_unified_shells(
    db: Session = Depends(get_db),
    current_user: User = Depends(security.get_current_user),
):
    """
    Get unified list of all available shells (both public and user-defined).

    Each shell includes a 'type' field ('public' or 'user') to identify its source.

    Response:
    {
      "data": [
        {
          "name": "shell-name",
          "type": "public" | "user",
          "displayName": "Human Readable Name",
          "runtime": "ClaudeCode",
          "baseImage": "ghcr.io/...",
          "shellType": "local_engine" | "external_api"
        }
      ]
    }
    """
    result = []

    # Get public shells
    public_shells = (
        db.query(PublicShell)
        .filter(PublicShell.is_active == True)  # noqa: E712
        .order_by(PublicShell.name.asc())
        .all()
    )
    for shell in public_shells:
        try:
            result.append(_public_shell_to_unified(shell))
        except Exception as e:
            logger.warning(f"Failed to parse public shell {shell.name}: {e}")

    # Get user-defined shells
    user_shells = (
        db.query(Kind)
        .filter(
            Kind.user_id == current_user.id,
            Kind.kind == "Shell",
            Kind.namespace == "default",
            Kind.is_active == True,  # noqa: E712
        )
        .order_by(Kind.name.asc())
        .all()
    )
    for shell in user_shells:
        try:
            result.append(_user_shell_to_unified(shell))
        except Exception as e:
            logger.warning(f"Failed to parse user shell {shell.name}: {e}")

    return {"data": [s.model_dump() for s in result]}


@router.get("/unified/{shell_name}", response_model=dict)
def get_unified_shell(
    shell_name: str,
    shell_type: Optional[str] = Query(
        None, description="Shell type ('public' or 'user')"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(security.get_current_user),
):
    """
    Get a specific shell by name, optionally with type hint.

    If shell_type is not provided, it will try to find the shell
    in the following order:
    1. User's own shells (type='user')
    2. Public shells (type='public')
    """
    # Try user shells first if no type specified or type is 'user'
    if shell_type in (None, "user"):
        user_shell = (
            db.query(Kind)
            .filter(
                Kind.user_id == current_user.id,
                Kind.kind == "Shell",
                Kind.name == shell_name,
                Kind.namespace == "default",
                Kind.is_active == True,  # noqa: E712
            )
            .first()
        )
        if user_shell:
            return _user_shell_to_unified(user_shell).model_dump()
        if shell_type == "user":
            raise HTTPException(status_code=404, detail="User shell not found")

    # Try public shells
    public_shell = (
        db.query(PublicShell)
        .filter(
            PublicShell.name == shell_name,
            PublicShell.is_active == True,  # noqa: E712
        )
        .first()
    )
    if public_shell:
        return _public_shell_to_unified(public_shell).model_dump()

    raise HTTPException(status_code=404, detail="Shell not found")


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_shell(
    request: ShellCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(security.get_current_user),
):
    """
    Create a user-defined shell.

    The shell must be based on an existing public shell (baseShellRef).
    """
    # Validate name format
    name_regex = r"^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$"
    if not re.match(name_regex, request.name):
        raise HTTPException(
            status_code=400,
            detail="Shell name must contain only lowercase letters, numbers, and hyphens",
        )

    # Check if name already exists for this user
    existing = (
        db.query(Kind)
        .filter(
            Kind.user_id == current_user.id,
            Kind.kind == "Shell",
            Kind.name == request.name,
            Kind.namespace == "default",
            Kind.is_active == True,  # noqa: E712
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Shell name already exists")

    # Validate baseShellRef - must be a public shell with local_engine type
    base_shell = (
        db.query(PublicShell)
        .filter(
            PublicShell.name == request.baseShellRef,
            PublicShell.is_active == True,  # noqa: E712
        )
        .first()
    )
    if not base_shell:
        raise HTTPException(
            status_code=400, detail=f"Base shell '{request.baseShellRef}' not found"
        )

    base_shell_crd = ShellCRD.model_validate(base_shell.json)
    base_labels = base_shell_crd.metadata.labels or {}
    if base_labels.get("type") != "local_engine":
        raise HTTPException(
            status_code=400,
            detail="Base shell must be a local_engine type (not external_api)",
        )

    # Validate baseImage format (basic URL validation)
    if not request.baseImage or not re.match(
        r"^[a-z0-9.-]+(/[a-z0-9._-]+)+:[a-z0-9._-]+$", request.baseImage, re.IGNORECASE
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid base image format. Expected format: registry/image:tag",
        )

    # Create Shell CRD
    shell_crd = {
        "apiVersion": "agent.wecode.io/v1",
        "kind": "Shell",
        "metadata": {
            "name": request.name,
            "namespace": "default",
            "displayName": request.displayName,
            "labels": {"type": "local_engine"},  # User shells inherit local_engine type
        },
        "spec": {
            "runtime": base_shell_crd.spec.runtime,  # Inherit runtime from base shell
            "supportModel": base_shell_crd.spec.supportModel or [],
            "baseImage": request.baseImage,
            "baseShellRef": request.baseShellRef,
        },
        "status": {"state": "Available"},
    }

    db_obj = Kind(
        user_id=current_user.id,
        kind="Shell",
        name=request.name,
        namespace="default",
        json=shell_crd,
        is_active=True,
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)

    return _user_shell_to_unified(db_obj).model_dump()


@router.put("/{shell_name}", response_model=dict)
def update_shell(
    shell_name: str,
    request: ShellUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(security.get_current_user),
):
    """
    Update a user-defined shell.

    Only user-defined shells can be updated. Public shells are read-only.
    """
    # Get user shell
    shell = (
        db.query(Kind)
        .filter(
            Kind.user_id == current_user.id,
            Kind.kind == "Shell",
            Kind.name == shell_name,
            Kind.namespace == "default",
            Kind.is_active == True,  # noqa: E712
        )
        .first()
    )
    if not shell:
        raise HTTPException(status_code=404, detail="User shell not found")

    # Parse existing CRD
    shell_crd = ShellCRD.model_validate(shell.json)

    # Update fields
    if request.displayName is not None:
        shell_crd.metadata.displayName = request.displayName

    if request.baseImage is not None:
        # Validate baseImage format
        if not re.match(
            r"^[a-z0-9.-]+(/[a-z0-9._-]+)+:[a-z0-9._-]+$",
            request.baseImage,
            re.IGNORECASE,
        ):
            raise HTTPException(
                status_code=400,
                detail="Invalid base image format. Expected format: registry/image:tag",
            )
        shell_crd.spec.baseImage = request.baseImage

    # Save changes
    shell.json = shell_crd.model_dump(mode="json")
    db.add(shell)
    db.commit()
    db.refresh(shell)

    return _user_shell_to_unified(shell).model_dump()


@router.delete("/{shell_name}")
def delete_shell(
    shell_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(security.get_current_user),
):
    """
    Delete a user-defined shell.

    Only user-defined shells can be deleted. Public shells cannot be deleted.
    """
    # Get user shell
    shell = (
        db.query(Kind)
        .filter(
            Kind.user_id == current_user.id,
            Kind.kind == "Shell",
            Kind.name == shell_name,
            Kind.namespace == "default",
            Kind.is_active == True,  # noqa: E712
        )
        .first()
    )
    if not shell:
        raise HTTPException(status_code=404, detail="User shell not found")

    # Soft delete
    shell.is_active = False
    db.add(shell)
    db.commit()

    return {"message": "Shell deleted successfully"}


@router.post("/validate-image", response_model=ImageValidationResponse)
def validate_image(
    request: ImageValidationRequest,
    current_user: User = Depends(security.get_current_user),
):
    """
    Validate if a base image is compatible with a specific shell type.

    This endpoint proxies the validation request to Executor Manager, which:
    - Pulls the image and runs a temporary container to check dependencies
    - ClaudeCode: Node.js 20.x, claude-code CLI, SQLite 3.50+, Python 3.12
    - Agno: Python 3.12
    - Dify: No check needed (external_api type)

    Note: Validation is performed by Executor Manager to support various deployment
    modes (Docker, Kubernetes) where the backend may not have direct Docker access.
    """
    import os

    import httpx

    shell_type = request.shellType
    image = request.image

    # Dify doesn't need validation
    if shell_type == "Dify":
        return ImageValidationResponse(
            valid=True,
            checks=[],
            errors=["Dify is an external_api type and doesn't require image validation"],
        )

    # Get executor manager URL from environment
    executor_manager_url = os.getenv("EXECUTOR_MANAGER_URL", "http://localhost:8001")
    validate_url = f"{executor_manager_url}/executor-manager/images/validate"

    try:
        logger.info(f"Forwarding image validation to executor manager: {image}")

        # Call executor manager's validate-image API
        with httpx.Client(timeout=360.0) as client:  # 6 minutes timeout
            response = client.post(
                validate_url,
                json={"image": image, "shell_type": shell_type},
            )

        if response.status_code != 200:
            logger.error(
                f"Executor manager validation failed: {response.status_code} {response.text}"
            )
            return ImageValidationResponse(
                valid=False,
                checks=[],
                errors=[f"Executor manager error: {response.text}"],
            )

        result = response.json()
        logger.info(f"Image validation result from executor manager: valid={result.get('valid')}")

        # Convert result to response model
        checks = [
            ImageCheckResult(
                name=c.get("name", ""),
                version=c.get("version"),
                status=c.get("status", "fail"),
                message=c.get("message"),
            )
            for c in result.get("checks", [])
        ]

        return ImageValidationResponse(
            valid=result.get("valid", False),
            checks=checks,
            errors=result.get("errors", []),
        )

    except httpx.TimeoutException:
        logger.error(f"Timeout calling executor manager for image validation: {image}")
        return ImageValidationResponse(
            valid=False,
            checks=[],
            errors=["Validation request timed out. The image may be large or slow to pull."],
        )
    except httpx.RequestError as e:
        logger.error(f"Error calling executor manager: {e}")
        return ImageValidationResponse(
            valid=False,
            checks=[],
            errors=[f"Failed to connect to executor manager: {str(e)}"],
        )
    except Exception as e:
        logger.error(f"Image validation error: {e}")
        return ImageValidationResponse(
            valid=False,
            checks=[],
            errors=[f"Validation error: {str(e)}"],
        )
