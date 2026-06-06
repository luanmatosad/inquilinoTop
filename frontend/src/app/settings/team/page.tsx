import { getOrganization, listMembers, listInvites } from '@/lib/go/organization'
import { TeamClient } from './TeamClient'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const [organization, members, invites] = await Promise.all([
    getOrganization(),
    listMembers(),
    listInvites()
  ])

  return (
    <TeamClient 
      organization={organization} 
      members={members || []} 
      invites={invites || []} 
    />
  )
}
