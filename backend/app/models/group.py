# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

"""
Group and GroupMember models for resource organization
"""
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.base import Base


class Group(Base):
    """Group model for organizing users and resources"""

    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True, index=True)
    display_name = Column(String(100), nullable=False)
    parent_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    visibility = Column(String(20), default="private")
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Relationships
    parent = relationship("Group", remote_side=[id], backref="children")
    owner = relationship("User", backref="owned_groups")
    members = relationship("GroupMember", back_populates="group", cascade="all, delete-orphan")

    __table_args__ = (
        {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )


class GroupMember(Base):
    """GroupMember model for group membership"""

    __tablename__ = "group_members"

    id = Column(Integer, primary_key=True, index=True)
    group_name = Column(String(100), ForeignKey("groups.name"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # owner, admin, member
    invited_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Relationships
    group = relationship("Group", back_populates="members")
    user = relationship("User", foreign_keys=[user_id], backref="group_memberships")
    invited_by = relationship("User", foreign_keys=[invited_by_user_id])

    __table_args__ = (
        {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )
