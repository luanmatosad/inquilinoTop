// Valor em reais por extenso (pt-BR), para o texto do recibo: 1850 → "mil oitocentos e cinquenta reais".

const UNITS = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const HUNDREDS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

/** 1 a 999. */
function upTo999(n: number): string {
  if (n === 100) return 'cem'
  const parts: string[] = []
  const h = Math.floor(n / 100)
  const rest = n % 100
  if (h) parts.push(HUNDREDS[h])
  if (rest) {
    if (rest < 20) parts.push(UNITS[rest])
    else parts.push(TENS[Math.floor(rest / 10)] + (rest % 10 ? ` e ${UNITS[rest % 10]}` : ''))
  }
  return parts.join(' e ')
}

/** 1 a 999.999.999. */
function integer(n: number): string {
  const millions = Math.floor(n / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000
  const out: string[] = []
  if (millions) out.push(millions === 1 ? 'um milhão' : `${upTo999(millions)} milhões`)
  if (thousands) out.push(thousands === 1 ? 'mil' : `${upTo999(thousands)} mil`)
  if (rest) out.push(upTo999(rest))

  // "e" antes do último bloco quando ele é menor que 100 ou centena redonda (mil e cem, dois mil e um).
  if (out.length === 1) return out[0]
  const last = rest || thousands
  const joinWithE = rest ? rest < 100 || rest % 100 === 0 : thousands < 100 || thousands % 100 === 0
  const head = out.slice(0, -1).join(' ')
  return `${head}${joinWithE && last ? ' e ' : ' '}${out[out.length - 1]}`
}

export function valorPorExtenso(value: number): string {
  const total = Number.isFinite(value) && value > 0 ? Math.round(value * 100) : 0
  const reais = Math.floor(total / 100)
  const cents = total % 100

  const reaisText = reais === 0 ? '' : `${integer(reais)}${reais % 1_000_000 === 0 && reais >= 1_000_000 ? ' de' : ''} ${reais === 1 ? 'real' : 'reais'}`
  const centsText = cents === 0 ? '' : `${integer(cents)} ${cents === 1 ? 'centavo' : 'centavos'}`

  if (!reaisText && !centsText) return 'zero reais'
  return [reaisText, centsText].filter(Boolean).join(' e ')
}
