# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

"""
Pydantic schemas for Group and GroupMember models
"""
from datetime import datetime
from typing import List, Optional
from enum import Enum

from pydantic import BaseModel, Field


class GroupRole(str, Enum):
    """Group member roles with permission levels"""
    OWNER = "Owner"
    MAINTAINER = "Maintainer"
    DEVELOPER = "Developer"
    REPORTER = "Reporter"


# Group Schemas
class GroupBase(BaseModel):
    """Base group schema

    Groups use path-based naming:
    - Root group: "groupname"
    - Child group: "parent/child"
    """
    name: str = Field(..., min_length=1, max_length=255, description="Path-based group name (e.g., 'parent/child')")
    display_name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None


class GroupCreate(BaseModel):
    """Schema for creating a new group

    For root groups, provide simple name: "groupname"
    For child groups, provide full path: "parent/child"
    """
    name: str = Field(..., min_length=1, max_length=255, description="Group name or path")
    display_name: Optional[str] = Field(None, max_length=100)
    parent_path: Optional[str] = Field(None, description="Parent group path (will be prepended to name)")
    description: Optional[str] = None


class GroupUpdate(BaseModel):
    """Schema for updating group information"""
    display_name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None


class GroupInDB(GroupBase):
    """Database group schema"""
    id: int
    owner_user_id: int
    visibility: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GroupListItem(BaseModel):
    """Schema for group list item"""
    id: int
    name: str  # Full path: "parent/child"
    display_name: Optional[str]
    parent_path: Optional[str] = None  # Computed from name
    simple_name: Optional[str] = None  # Last segment of path
    description: Optional[str]
    member_count: int
    resource_count: int
    my_role: GroupRole
    created_at: datetime
    path_depth: int = 1  # Number of levels in hierarchy

    class Config:
        from_attributes = True


class GroupListResponse(BaseModel):
    """Schema for group list response"""
    total: int
    items: List[GroupListItem]


class GroupDetail(GroupInDB):
    """Detailed group information"""
    member_count: int
    resource_count: int
    my_role: GroupRole
    owner_name: str

    class Config:
        from_attributes = True


# GroupMember Schemas
class GroupMemberBase(BaseModel):
    """Base group member schema"""
    user_id: int
    role: GroupRole


class GroupMemberInvite(BaseModel):
    """Schema for inviting a member"""
    user_name: str
    role: GroupRole = GroupRole.DEVELOPER


class GroupMemberUpdate(BaseModel):
    """Schema for updating member role"""
    role: GroupRole


class GroupMemberInDB(GroupMemberBase):
    """Database group member schema"""
    id: int
    group_name: str
    invited_by_user_id: Optional[int]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GroupMemberListItem(BaseModel):
    """Schema for group member list item"""
    id: int
    user_id: int
    user_name: str
    role: GroupRole
    invited_by_user_id: Optional[int]
    invited_by_user_name: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class GroupMemberListResponse(BaseModel):
    """Schema for group member list response"""
    total: int
    items: List[GroupMemberListItem]


class TransferOwnershipRequest(BaseModel):
    """Schema for transferring group ownership"""
    new_owner_user_id: int


class InviteAllUsersRequest(BaseModel):
    """Schema for inviting all users to a group"""
    role: GroupRole = GroupRole.REPORTER


# Resource schemas with group information
class ResourceSource(str, Enum):
    """Resource source types"""
    PUBLIC = "public"
    PERSONAL = "personal"
    GROUP = "group"
    SHARED = "shared"


class ResourceWithSource(BaseModel):
    """Base schema for resources with source information"""
    source: ResourceSource
    group_name: Optional[str] = None

    class Config:
        from_attributes = True
