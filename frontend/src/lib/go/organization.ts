"use server"

import { goFetch } from './client'

export interface Organization {
  id: string
  name: string
  plan: string
}

export interface OrganizationMember {
  id: string
  user_id: string
  user_email?: string
  role: string
  branch_id?: string
  branch_name?: string
  created_at: string
}

export interface OrganizationInvite {
  id: string
  email: string
  role: string
  expires_at: string
  accepted_at?: string
}

export async function getOrganization(): Promise<Organization> {
  return goFetch<Organization>('/api/v1/organizations/me')
}

export async function listMembers(): Promise<OrganizationMember[]> {
  return goFetch<OrganizationMember[]>('/api/v1/organizations/members')
}

export async function listInvites(): Promise<OrganizationInvite[]> {
  return goFetch<OrganizationInvite[]>('/api/v1/organizations/invites')
}

export async function inviteMember(email: string, role: string): Promise<OrganizationInvite> {
  return goFetch<OrganizationInvite>('/api/v1/organizations/invites', {
    method: 'POST',
    body: JSON.stringify({ email, role })
  })
}

export async function removeMember(memberId: string): Promise<void> {
  return goFetch<void>(`/api/v1/organizations/members/${memberId}`, {
    method: 'DELETE'
  })
}

export async function updateMemberRole(memberId: string, role: string): Promise<void> {
  return goFetch<void>(`/api/v1/organizations/members/${memberId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role })
  })
}

export async function cancelInvite(inviteId: string): Promise<void> {
  return goFetch<void>(`/api/v1/organizations/invites/${inviteId}/cancel`, {
    method: 'POST'
  })
}
