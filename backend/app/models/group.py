# SPDX-FileCopyrightText: 2025 Weibo, Inc.
#
# SPDX-License-Identifier: Apache-2.0

"""
Group model for organization-level resource management
"""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Group(Base):
    """Group model for organizing users and resources

    Groups use path-based naming for hierarchy:
    - Root group: "groupname"
    - Child group: "parent/child"
    - Nested child: "parent/child/grandchild"
    """

    __tablename__ = "namespace"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)  # Path-based: "parent/child"
    display_name = Column(String(100), nullable=True)
    owner_user_id = Column(Integer, nullable=False, index=True)
    visibility = Column(String(20), default="private")  # Reserved for future use
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


    @property
    def parent_path(self) -> str:
        """Get parent group path from name"""
        if '/' in self.name:
            return '/'.join(self.name.split('/')[:-1])
        return None

    @property
    def path_depth(self) -> int:
        """Get the depth of the group in the hierarchy"""
        return self.name.count('/') + 1

    __table_args__ = (
        {
            "sqlite_autoincrement": True,
            "mysql_engine": "InnoDB",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )
