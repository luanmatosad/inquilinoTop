import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger } from '@/components/ui/select'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

// Medidas do CSS das artboards do canvas (spec ui-primitives). O jsdom não aplica Tailwind, então
// conferimos as classes que produzem essas medidas.
const cls = (el: Element | null) => (el?.getAttribute('class') ?? '').split(/\s+/)

describe('campos de formulário', () => {
  it('Input: 44px no celular, 36px a partir de md, raio 6 e sombra', () => {
    const c = cls(render(<Input />).container.querySelector('input'))
    expect(c).toEqual(expect.arrayContaining(['h-11', 'md:h-9', 'rounded-md', 'shadow-xs', 'border']))
    expect(c).not.toContain('h-8')
  })

  it('Select (gatilho): mesmas alturas do Input no tamanho padrão', () => {
    const { container } = render(
      <Select>
        <SelectTrigger />
      </Select>,
    )
    const c = cls(container.querySelector('[data-slot="select-trigger"]'))
    expect(c).toEqual(expect.arrayContaining(['data-[size=default]:h-11', 'md:data-[size=default]:h-9', 'rounded-md', 'shadow-xs']))
  })

  it('Textarea: raio 6, borda e sombra', () => {
    const c = cls(render(<Textarea />).container.querySelector('textarea'))
    expect(c).toEqual(expect.arrayContaining(['rounded-md', 'shadow-xs', 'border']))
  })
})

describe('Button', () => {
  it('tamanho padrão: 44px no celular e 32px a partir de md', () => {
    const c = cls(render(<Button>ok</Button>).container.querySelector('button'))
    expect(c).toEqual(expect.arrayContaining(['h-11', 'md:h-8', 'rounded-md', 'text-sm', 'font-medium']))
  })

  it('tamanhos pequenos e de ícone não mudam de altura', () => {
    expect(cls(render(<Button size="sm">x</Button>).container.querySelector('button'))).toContain('h-7')
    expect(cls(render(<Button size="icon">x</Button>).container.querySelector('button'))).toContain('size-8')
  })
})

describe('Badge', () => {
  it('altura 20px e pílula', () => {
    const c = cls(render(<Badge>ok</Badge>).container.querySelector('[data-slot="badge"]'))
    expect(c).toEqual(expect.arrayContaining(['h-5', 'rounded-full', 'text-xs', 'font-medium']))
    expect(c).not.toContain('py-0.5')
  })
})

describe('Card', () => {
  it('padrão: raio 12, borda, sombra e 16px de espaçamento', () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Título</CardTitle>
        </CardHeader>
        <CardContent>corpo</CardContent>
      </Card>,
    )
    expect(cls(container.querySelector('[data-slot="card"]'))).toEqual(
      expect.arrayContaining(['rounded-xl', 'border', 'shadow-sm', 'gap-4', 'py-4']),
    )
    expect(cls(container.querySelector('[data-slot="card-header"]'))).toEqual(expect.arrayContaining(['px-4', 'gap-1']))
    expect(cls(container.querySelector('[data-slot="card-content"]'))).toContain('px-4')
    expect(cls(container.querySelector('[data-slot="card-title"]'))).toEqual(
      expect.arrayContaining(['text-base', 'leading-6', 'font-semibold']),
    )
  })

  it('size="flush": sem espaçamento vertical (contêiner de tabela)', () => {
    const c = cls(render(<Card size="flush" />).container.querySelector('[data-slot="card"]'))
    expect(c).toEqual(expect.arrayContaining(['gap-0', 'py-0', 'overflow-hidden']))
    expect(c).not.toContain('py-4')
  })
})

describe('Table', () => {
  it('cabeçalho 12px/500 em muted; células 12×16; linha de 56px', () => {
    const { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Ana</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )
    expect(cls(container.querySelector('th'))).toEqual(
      expect.arrayContaining(['bg-muted', 'text-xs', 'font-medium', 'text-muted-foreground', 'px-4']),
    )
    expect(cls(container.querySelector('td'))).toEqual(expect.arrayContaining(['px-4', 'py-3']))
    expect(cls(container.querySelector('tbody'))).toContain('[&_tr]:h-14')
  })
})

describe('Sheet lateral', () => {
  it('à direita: largura 440 a partir de sm, cheia no celular, e 24px de padding', () => {
    render(
      <Sheet open>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>t</SheetTitle>
          </SheetHeader>
          <SheetFooter>f</SheetFooter>
        </SheetContent>
      </Sheet>,
    )
    const content = cls(document.querySelector('[data-slot="sheet-content"]'))
    expect(content).toEqual(expect.arrayContaining(['data-[side=right]:w-full', 'data-[side=right]:sm:max-w-[440px]']))
    expect(content).not.toContain('data-[side=right]:sm:max-w-sm')
    expect(cls(document.querySelector('[data-slot="sheet-header"]'))).toContain('p-6')
    expect(cls(document.querySelector('[data-slot="sheet-footer"]'))).toContain('p-6')
  })
})
