import React from 'react'
import { getPayables } from '../actions'
import { PayablesClient } from './_components/PayablesClient'
import type { PayablesState } from './_components/PayablesClient'

export default async function PayablesPage() {
  let payables = null
  try {
    payables = await getPayables()
  } catch {
    payables = null
  }

  const state: PayablesState =
    payables === null
      ? { kind: 'error' }
      : payables.length === 0
        ? { kind: 'empty' }
        : { kind: 'data', payables }

  return (
    <div className="space-y-5 pb-16">
      <PayablesClient state={state} />
    </div>
  )
}
