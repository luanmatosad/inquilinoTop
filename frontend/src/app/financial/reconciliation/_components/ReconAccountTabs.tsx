'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { fmtBRL } from '@/lib/format'
import type { BankAccount } from '../../actions'

interface ReconAccountTabsProps {
  accounts: BankAccount[]
  currentId: string
}

function bankInitials(bank: string) {
  return bank.replace(/\s+PJ$/i, '').slice(0, 2).toUpperCase()
}

export function ReconAccountTabs({ accounts, currentId }: ReconAccountTabsProps) {
  const router = useRouter()

  if (accounts.length === 0) return null

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${accounts.length}, minmax(0, 1fr))` }}
    >
      {accounts.map(acc => {
        const isActive = acc.id === currentId
        return (
          <button
            key={acc.id}
            onClick={() => router.replace(`?accountId=${acc.id}`)}
            className={cn(
              'flex items-center gap-3 rounded-[10px] border p-3 text-left transition-all',
              isActive
                ? 'border-primary shadow-[0_0_0_2px_rgba(0,87,190,.15)]'
                : 'border-border bg-surface-container-low hover:border-primary/40',
            )}
          >
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-[8px] size-9 text-white text-sm font-semibold"
              style={{ background: acc.brandColor }}
            >
              {bankInitials(acc.bank)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-on-surface truncate">{acc.label}</p>
              <p className="text-[11.5px] font-normal text-on-surface-variant font-mono truncate">
                {acc.bank} · Ag {acc.agency} · CC {acc.number}
              </p>
            </div>
            <div className="ml-auto text-right flex-shrink-0">
              <p className="text-[10.5px] font-medium uppercase text-on-surface-variant">Saldo</p>
              <p className="text-[13px] font-semibold tabular-nums text-on-surface">
                {fmtBRL(acc.balance)}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
