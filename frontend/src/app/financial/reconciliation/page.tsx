import { getBankAccounts, getReconciliation } from '../actions'
import { ReconciliationClient } from './_components/ReconciliationClient'

interface PageProps {
  searchParams: Promise<{ accountId?: string }>
}

export default async function ReconciliationPage({ searchParams }: PageProps) {
  const params = await searchParams
  const accounts = await getBankAccounts().catch(() => [])

  const currentAccountId = params.accountId ?? accounts[0]?.id ?? ''

  let data = null
  let error = false

  if (currentAccountId) {
    try {
      data = await getReconciliation({ accountId: currentAccountId })
    } catch {
      error = true
    }
  }

  return (
    <ReconciliationClient
      accounts={accounts}
      data={data}
      error={error}
      currentAccountId={currentAccountId}
    />
  )
}
