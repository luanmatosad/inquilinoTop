'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { CommissionOperation, CommissionItem } from '../../actions'

const COMM_TABS: { id: CommissionOperation; label: string }[] = [
  { id: 'LEASE', label: 'Locação' },
  { id: 'SALE', label: 'Venda' },
  { id: 'CAPTURE', label: 'Captação' },
]

interface CommissionsTabBarProps {
  activeTab: CommissionOperation
  commissions: CommissionItem[]
}

export function CommissionsTabBar({ activeTab, commissions }: CommissionsTabBarProps) {
  const router = useRouter()

  const counts = COMM_TABS.reduce((acc, tab) => {
    acc[tab.id] = commissions.filter(c => c.operation === tab.id).length
    return acc
  }, {} as Record<CommissionOperation, number>)

  return (
    <div className="flex gap-0 border-b border-border">
      {COMM_TABS.map(tab => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            onClick={() => router.replace(`?tab=${tab.id}`)}
            className={cn(
              'relative flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors',
              isActive
                ? 'text-primary border-b-2 border-primary -mb-px bg-[rgba(0,87,190,.06)]'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            {tab.label}
            {counts[tab.id] > 0 && (
              <span
                className={cn(
                  'min-w-[18px] h-[18px] rounded-full px-1 text-[10px] font-semibold flex items-center justify-center',
                  isActive
                    ? 'bg-primary text-white'
                    : 'bg-surface-container text-on-surface-variant',
                )}
              >
                {counts[tab.id]}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
