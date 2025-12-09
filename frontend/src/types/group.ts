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
  display_name?: string | null
  description?: string | null
}

export interface GroupCreate {
  name: string
  display_name?: string | null
  parent_path?: string | null
  description?: string | null
}

export interface GroupUpdate {
  display_name?: string | null
  description?: string | null
}

export interface GroupInDB {
  id: number
  name: string
  display_name?: string | null
  owner_user_id: number
  visibility: string
  description?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface GroupListItem {
  id: number
  name: string
  display_name?: string | null
  parent_path?: string | null
  simple_name?: string | null
  description?: string | null
  member_count: number
  resource_count: number
  my_role: GroupRole
  created_at: string
  path_depth?: number
}

export interface GroupListResponse {
  total: number
  items: GroupListItem[]
}

export interface GroupDetail extends GroupInDB {
  display_name?: string | null
  parent_name?: string | null
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
  group_name: string
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
  group_name?: string | null
}
