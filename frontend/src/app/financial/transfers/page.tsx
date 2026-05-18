import React from 'react'
import { getTransfers } from '../actions'
import { TransfersClient } from './_components/TransfersClient'
import type { TransfersState } from './_components/TransfersClient'

export default async function TransfersPage() {
  let result = null
  try {
    result = await getTransfers()
  } catch {
    result = null
  }

  const state: TransfersState =
    result === null
      ? { kind: 'error' }
      : result.transfers.length === 0
        ? { kind: 'empty' }
        : { kind: 'data', data: result }

  return (
    <div className="space-y-5 pb-16">
      <TransfersClient state={state} />
    </div>
  )
}
