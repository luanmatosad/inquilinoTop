import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Página com credencial no endereço: fora dos buscadores e sem repassar o link a outros sites.
export const metadata: Metadata = {
  title: 'Sua cobrança',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function PublicChargeLayout({ children }: { children: ReactNode }) {
  return children
}
