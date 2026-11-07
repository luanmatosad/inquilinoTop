export function onlyDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

/** CPF (até 11 dígitos) ou CNPJ (12 a 14), conforme o que foi digitado. */
export function maskCpfCnpj(value: string | null | undefined): string {
  const d = onlyDigits(value).slice(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5')
}

export function maskCep(value: string | null | undefined): string {
  return onlyDigits(value).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')
}

/** Telefone BR: (11) 99999-8888 ou (11) 3333-4444. */
export function maskPhone(value: string | null | undefined): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return d.replace(/^(\d{2})(\d+)/, '($1) $2')
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d+)/, '($1) $2-$3')
  return d.replace(/^(\d{2})(\d{5})(\d+)/, '($1) $2-$3')
}

// Máscara parcial para exibição fora da edição (lista e detalhe): CPF 123.456.xxx-09 e CNPJ 12.345.xxx/0001-90,
// com asteriscos no lugar dos "x".
export function maskDocumentPartial(value: string | null | undefined): string {
  const d = onlyDigits(value)
  if (d.length === 0) return ''
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.***-${d.slice(9)}`
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.***/${d.slice(8, 12)}-${d.slice(12)}`
  // Formato inesperado: esconder tudo é mais seguro do que adivinhar onde cortar.
  return '***'
}
