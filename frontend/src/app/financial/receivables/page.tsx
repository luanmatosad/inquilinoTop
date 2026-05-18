import React from 'react'
import { getReceivables, getActiveLeases } from '../actions'
import { ReceivablesClient } from './_components/ReceivablesClient'
import type { ReceivablesState } from './_components/ReceivablesClient'

export default async function ReceivablesPage() {
  const [paymentsResult, leasesResult] = await Promise.allSettled([
    getReceivables(),
    getActiveLeases(),
  ])

  const payments =
    paymentsResult.status === 'fulfilled' ? paymentsResult.value : null
  const leases =
    leasesResult.status === 'fulfilled' ? leasesResult.value : null

  const state: ReceivablesState =
    payments === null || leases === null
      ? { kind: 'error' }
      : payments.length === 0
        ? { kind: 'empty' }
        : { kind: 'data', payments, leases }

  return (
    <div className="space-y-6">
      <ReceivablesClient state={state} />
    </div>
  )
}
