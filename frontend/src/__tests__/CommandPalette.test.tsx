import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'

const push = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/',
}))

import { CommandPalette } from '@/components/CommandPalette'

beforeAll(() => {
  // cmdk usa ResizeObserver e scrollIntoView, ausentes no jsdom.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView ??= () => {}
})

function Harness({ initial = false }: { initial?: boolean }) {
  const [open, setOpen] = useState(initial)
  return <CommandPalette open={open} onOpenChange={setOpen} />
}

describe('CommandPalette', () => {
  it('fechada por padrão', () => {
    render(<Harness />)
    expect(screen.queryByPlaceholderText('Ir para...')).not.toBeInTheDocument()
  })

  it('Ctrl+K abre e Ctrl+K fecha', () => {
    render(<Harness />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.getByPlaceholderText('Ir para...')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.queryByPlaceholderText('Ir para...')).not.toBeInTheDocument()
  })

  it('Cmd+K abre', () => {
    render(<Harness />)
    fireEvent.keyDown(window, { key: 'K', metaKey: true })
    expect(screen.getByPlaceholderText('Ir para...')).toBeInTheDocument()
  })

  it('tecla k sem modificador não abre', () => {
    render(<Harness />)
    fireEvent.keyDown(window, { key: 'k' })
    expect(screen.queryByPlaceholderText('Ir para...')).not.toBeInTheDocument()
  })

  it('selecionar item navega e fecha', () => {
    push.mockClear()
    render(<Harness initial />)
    fireEvent.click(screen.getByText('Imóveis'))
    expect(push).toHaveBeenCalledWith('/properties')
    expect(screen.queryByPlaceholderText('Ir para...')).not.toBeInTheDocument()
  })

  it('buscar "inquil" mostra Inquilinos e confirmar navega para /tenants', () => {
    push.mockClear()
    render(<Harness initial />)
    fireEvent.change(screen.getByPlaceholderText('Ir para...'), { target: { value: 'inquil' } })
    expect(screen.getByText('Inquilinos')).toBeInTheDocument()
    expect(screen.queryByText('Imóveis')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Inquilinos'))
    expect(push).toHaveBeenCalledWith('/tenants')
  })

  it.each(['laudo', 'importar', 'documentos', 'fechamento'])(
    'buscar "%s" não encontra nada (sem item de menu no canvas)',
    (term) => {
      render(<Harness initial />)
      fireEvent.change(screen.getByPlaceholderText('Ir para...'), { target: { value: term } })
      expect(screen.getByText('Nenhuma página encontrada.')).toBeInTheDocument()
    },
  )
})
