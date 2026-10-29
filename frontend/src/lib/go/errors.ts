export interface GoErrorInfo {
  code?: string
  status?: number
  message: string
}

/** Extrai code/status anexados pelo goFetch ao Error de uma resposta não-2xx. */
export function goErrorInfo(err: unknown, fallback = "Erro inesperado"): GoErrorInfo {
  if (err instanceof Error) {
    const { code, status } = err as Error & { code?: string; status?: number }
    return { code, status, message: err.message || fallback }
  }
  return { message: fallback }
}
