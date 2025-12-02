// SPDX-FileCopyrightText: 2025 Weibo, Inc.
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Group and GroupMember TypeScript types
 */

export enum GroupRole {
  OWNER = 'Owner',
  MAINTAINER = 'Maintainer',
  DEVELOPER = 'Developer',
  REPORTER = 'Reporter',
}

export enum ResourceSource {
  PUBLIC = 'public',
  PERSONAL = 'personal',
  GROUP = 'group',
  SHARED = 'shared',
}

export interface GroupBase {
  name: string
  parent_id?: number | null
  description?: string | null
}

export interface GroupCreate extends GroupBase {}

export interface GroupUpdate {
  name?: string
  description?: string | null
}

export interface GroupInDB extends GroupBase {
  id: number
  owner_user_id: number
  visibility: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface GroupListItem {
  id: number
  name: string
  parent_id?: number | null
  description?: string | null
  member_count: number
  resource_count: number
  my_role: GroupRole
  created_at: string
}

export interface GroupListResponse {
  total: number
  items: GroupListItem[]
}

export interface GroupDetail extends GroupInDB {
  member_count: number
  resource_count: number
  my_role: GroupRole
  owner_name: string
}

// GroupMember Types
export interface GroupMemberBase {
  user_id: number
  role: GroupRole
}

export interface GroupMemberInvite {
  user_name: string
  role?: GroupRole
}

export interface GroupMemberUpdate {
  role: GroupRole
}

export interface GroupMemberInDB extends GroupMemberBase {
  id: number
  group_id: number
  invited_by_user_id?: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface GroupMemberListItem {
  id: number
  user_id: number
  user_name: string
  role: GroupRole
  invited_by_user_id?: number | null
  invited_by_user_name?: string | null
  created_at: string
}

export interface GroupMemberListResponse {
  total: number
  items: GroupMemberListItem[]
}

export interface TransferOwnershipRequest {
  new_owner_user_id: number
}

export interface InviteAllUsersRequest {
  role?: GroupRole
}

// Resource with source information
export interface ResourceWithSource {
  source: ResourceSource
  group_id?: number | null
  group_name?: string | null
}
