export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
const EXT = /\.(pdf|docx?)$/i

/** Valida o contrato assinado antes de enviar: PDF, DOC ou DOCX de até 10 MB. */
export function validateContractFile(f: { name: string; size: number }): string | null {
  if (!EXT.test(f.name)) return 'Envie um arquivo PDF, DOC ou DOCX.'
  if (f.size > MAX_DOCUMENT_BYTES) return 'O arquivo excede 10 MB.'
  if (f.size === 0) return 'O arquivo está vazio.'
  return null
}
