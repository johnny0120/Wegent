# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

"""
Pydantic schemas for Group and GroupMember
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class GroupBase(BaseModel):
    """Base schema for Group"""
    name: str = Field(..., min_length=1, max_length=100, description="Unique group name (immutable)")
    display_name: str = Field(..., min_length=1, max_length=100, description="Display name (can be modified)")
    description: Optional[str] = Field(None, description="Group description")
    visibility: str = Field(default="private", description="Group visibility: private, public")
    parent_id: Optional[int] = Field(None, description="Parent group ID for hierarchical organization")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate group name format"""
        if not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError("Group name must contain only alphanumeric characters, hyphens, and underscores")
        return v


class GroupCreate(GroupBase):
    """Schema for creating a Group"""
    pass


class GroupUpdate(BaseModel):
    """Schema for updating a Group"""
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    visibility: Optional[str] = None
    parent_id: Optional[int] = None


class GroupResponse(GroupBase):
    """Schema for Group response"""
    id: int
    owner_user_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GroupWithMembers(GroupResponse):
    """Schema for Group with member count"""
    member_count: int = 0
    role: Optional[str] = None  # Current user's role in the group


class GroupMemberBase(BaseModel):
    """Base schema for GroupMember"""
    group_name: str = Field(..., description="Group name")
    user_id: int = Field(..., description="User ID")
    role: str = Field(default="member", description="Role: owner, admin, member")


class GroupMemberCreate(GroupMemberBase):
    """Schema for creating a GroupMember"""
    pass


class GroupMemberUpdate(BaseModel):
    """Schema for updating a GroupMember"""
    role: Optional[str] = Field(None, description="Update member role")


class GroupMemberResponse(GroupMemberBase):
    """Schema for GroupMember response"""
    id: int
    invited_by_user_id: Optional[int]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GroupMemberWithUser(GroupMemberResponse):
    """Schema for GroupMember with user details"""
    user_name: str
    user_email: Optional[str] = None
