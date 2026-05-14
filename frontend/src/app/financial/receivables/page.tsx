import React from 'react'
import { getReceivables, getActiveLeases } from '../actions'
import { ReceivablesClient } from './_components/ReceivablesClient'

export default async function ReceivablesPage() {
  const [receivables, leases] = await Promise.all([
    getReceivables(),
    getActiveLeases(),
  ])

  return (
    <div className="space-y-6">
      <ReceivablesClient receivables={receivables} leases={leases} />
    </div>
  )
}
