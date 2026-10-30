'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

const KEY = 'financial.payables.legacy-notice.dismissed'

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Avisa, uma vez, que despesas anteriores ao controle de status aparecem como pendentes/atrasadas. */
export function LegacyExpensesNotice({ lateCount }: { lateCount: number }) {
  // Começa oculto para servidor e cliente renderizarem igual; o efeito mostra o aviso se ainda não foi dispensado.
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    setHidden(readDismissed()) // eslint-disable-line react-hooks/set-state-in-effect
  }, [])

  if (hidden || lateCount === 0) return null

  function dismiss() {
    try {
      window.localStorage.setItem(KEY, '1')
    } catch {
      // sem armazenamento: o aviso só some nesta sessão
    }
    setHidden(true)
  }

  return (
    <div role="status" className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start justify-between gap-4">
      <p>
        Despesas lançadas antes do controle de pagamento aparecem como pendentes ou atrasadas. Se algumas já foram pagas,
        marque-as na lista e use <strong>Pagar selecionadas</strong> para dar baixa de uma vez.
      </p>
      <Button variant="outline" size="sm" onClick={dismiss}>Entendi</Button>
    </div>
  )
}
