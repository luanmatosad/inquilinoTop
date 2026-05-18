import { ArrowDown, ArrowUp } from 'lucide-react'

interface MatchPreviewProps {
  match: {
    kind: 'receivable' | 'payable'
    title: string
    sub: string
  } | null
}

export function MatchPreview({ match }: MatchPreviewProps) {
  if (!match) {
    return (
      <span className="text-[12.5px] italic text-on-surface-variant">
        Nenhum item interno casa com esta linha.
      </span>
    )
  }

  const isReceivable = match.kind === 'receivable'

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-[7px] size-7"
        style={{
          background: isReceivable
            ? 'rgba(34,197,94,.12)'
            : 'rgba(186,26,26,.08)',
        }}
      >
        {isReceivable ? (
          <ArrowDown className="size-3.5 text-[#15803d]" />
        ) : (
          <ArrowUp className="size-3.5 text-[#7f1010]" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-on-surface truncate">{match.title}</p>
        <p className="text-[11.5px] text-on-surface-variant">{match.sub}</p>
      </div>
    </div>
  )
}
