// PUT /leases/{id} é substituição total: o que o formulário não mostra volta do contrato atual.

type Current = {
  deposit_amount?: number | null
  iptu_year?: number | null
  annual_iptu_amount?: number | null
  status?: string
}
type FormPart = { iptu_reimbursable?: boolean; annual_iptu_amount?: number | null }

export function preserveLeaseFields(current: Current, form: FormPart) {
  return {
    deposit_amount: current.deposit_amount ?? undefined,
    iptu_year: current.iptu_year ?? undefined,
    status: current.status,
    annual_iptu_amount: form.iptu_reimbursable ? (form.annual_iptu_amount ?? undefined) : (current.annual_iptu_amount ?? undefined),
  }
}

/** Prévia do reajuste: novo aluguel e aumento, arredondados a centavos. */
export function previewReadjustment(rent: number, percent: number) {
  if (!Number.isFinite(percent) || percent <= 0) return { newAmount: rent, increase: 0 }
  const newAmount = Math.round(rent * (1 + percent / 100) * 100) / 100
  return { newAmount, increase: Math.round((newAmount - rent) * 100) / 100 }
}
