import { Info } from 'lucide-react'
import { fmtBRL, fmtPct } from '@/lib/format'
import type { Broker, CommissionOperation } from '../../actions'

interface CommissionPreviewProps {
  broker: Broker | null
  captureBroker: Broker | null
  base: number
  pct: number
  splitOperator: number
  grossOperator: number
  grossCapturer: number
  irrf: number
  irrfRate: number
  net: number
  operation: CommissionOperation
}

function PreviewLine({ label, value, muted, bold, highlight, negative }: {
  label: string; value: string
  muted?: boolean; bold?: boolean; highlight?: boolean; negative?: boolean
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-[12px] ${muted ? 'text-on-surface-variant' : 'text-on-surface'}`}>{label}</span>
      <span className={`text-[13px] tabular-nums ${bold ? 'font-bold' : 'font-normal'} ${highlight ? 'text-[#15803d]' : negative ? 'text-[#7f1010]' : muted ? 'text-on-surface-variant' : 'text-on-surface'}`}>
        {value}
      </span>
    </div>
  )
}

export function CommissionPreview({
  broker, captureBroker, base, pct, splitOperator,
  grossOperator, grossCapturer, irrf, irrfRate, net, operation,
}: CommissionPreviewProps) {
  const hasSplit = captureBroker !== null && splitOperator < 100

  return (
    <div className="flex flex-col gap-3 rounded-[10px] bg-surface-container-low p-[14px] h-full">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-on-surface-variant">
        Resumo do cálculo
      </p>

      <div className="space-y-2">
        <PreviewLine
          label="Base"
          value={fmtBRL(base)}
        />
        <PreviewLine
          label={operation === 'LEASE' ? `× 1× (1 mês de aluguel)` : `× ${fmtPct(pct)}`}
          value=""
          muted
        />

        {hasSplit && (
          <>
            <div className="border-t border-border my-2" />
            {broker && (
              <PreviewLine
                label={`${broker.name.split(' ')[0]} (${splitOperator}%)`}
                value={fmtBRL(grossOperator)}
              />
            )}
            {captureBroker && (
              <PreviewLine
                label={`${captureBroker.name.split(' ')[0]} (${100 - splitOperator}%)`}
                value={fmtBRL(grossCapturer)}
                muted
              />
            )}
          </>
        )}

        <div className="border-t border-border my-2" />
        <PreviewLine label="Bruto" value={fmtBRL(grossOperator)} bold />

        {irrf > 0 && (
          <PreviewLine
            label={`IRRF (${Math.round(irrfRate * 100)}%)`}
            value={`−${fmtBRL(irrf)}`}
            negative
          />
        )}

        <div className="border-t border-border my-2" />
        <PreviewLine
          label="Líquido"
          value={fmtBRL(net)}
          bold
          highlight
        />
      </div>

      <div className="mt-auto flex gap-2 rounded-[8px] border border-[rgba(0,87,190,.15)] bg-[rgba(0,87,190,.05)] px-3 py-2.5">
        <Info className="mt-0.5 size-3.5 flex-shrink-0 text-primary" />
        <p className="text-[11px] text-on-surface-variant leading-relaxed">
          Ao marcar como paga, geramos um lançamento em Contas a pagar com categoria Comissão.
        </p>
      </div>
    </div>
  )
}
