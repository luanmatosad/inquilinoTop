import { getCommissionsData } from '../actions'
import { CommissionsClient } from './_components/CommissionsClient'
import type { CommissionOperation } from '../actions'

const VALID_TABS: CommissionOperation[] = ['LEASE', 'SALE', 'CAPTURE']

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function CommissionsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const rawTab = params.tab?.toUpperCase() as CommissionOperation | undefined
  const activeTab: CommissionOperation = rawTab && VALID_TABS.includes(rawTab) ? rawTab : 'LEASE'

  let data = null
  let error = false

  try {
    data = await getCommissionsData()
  } catch {
    error = true
  }

  return (
    <CommissionsClient
      data={data}
      error={error}
      activeTab={activeTab}
    />
  )
}
