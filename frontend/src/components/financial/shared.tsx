export const money = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

// Datas do backend são DATE (meia-noite UTC): formatar em UTC evita voltar um dia no fuso do Brasil.
export const fmtDate = (v: string) => new Date(v).toLocaleDateString("pt-BR", { timeZone: "UTC" })
