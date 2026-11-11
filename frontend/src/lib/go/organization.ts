"use server"

import { goFetch } from './client'
import { refreshAccessToken } from './server-auth'

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

export interface MyMembership {
  organization: Organization
  role: string
  branch_id?: string
  permissions: string[]
}

export async function getOrganization(): Promise<Organization> {
  return goFetch<Organization>('/api/v1/organizations/me')
}

export async function getMyMembership(): Promise<MyMembership> {
  return goFetch<MyMembership>('/api/v1/organizations/me/membership')
}

export async function createOrganization(name: string): Promise<Organization> {
  try {
    return await goFetch<Organization>('/api/v1/organizations', {
      method: 'POST',
      body: JSON.stringify({ name })
    })
  } finally {
    // Token novo carrega organization_id; sem refresh o middleware manda de volta ao onboarding.
    await refreshAccessToken()
  }
}

export async function acceptInvite(token: string): Promise<void> {
  await goFetch<{ message: string }>('/api/v1/invites/accept', {
    method: 'POST',
    body: JSON.stringify({ token })
  })
}

export async function listMembers(): Promise<OrganizationMember[]> {
  return goFetch<OrganizationMember[]>('/api/v1/organizations/me/members')
}

export async function listInvites(): Promise<OrganizationInvite[]> {
  return goFetch<OrganizationInvite[]>('/api/v1/organizations/me/invites')
}

export async function inviteMember(email: string, role: string): Promise<OrganizationInvite> {
  return goFetch<OrganizationInvite>('/api/v1/organizations/me/invites', {
    method: 'POST',
    body: JSON.stringify({ email, role })
  })
}

export async function removeMember(memberId: string): Promise<void> {
  return goFetch<void>(`/api/v1/organizations/me/members/${memberId}`, {
    method: 'DELETE'
  })
}

export async function updateMemberRole(memberId: string, role: string): Promise<void> {
  return goFetch<void>(`/api/v1/organizations/me/members/${memberId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role })
  })
}

export async function cancelInvite(inviteId: string): Promise<void> {
  return goFetch<void>(`/api/v1/organizations/me/invites/${inviteId}`, {
    method: 'DELETE'
  })
}
