/**
 * Destino interno seguro para o parâmetro `next` (login → página original). Só aceita caminho
 * relativo ao app: `//host` e `/\host` apontariam para outro site. Qualquer outra coisa cai em `/`.
 */
export function safeNextPath(value: FormDataEntryValue | string | null | undefined): string {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/'
  return value
}
