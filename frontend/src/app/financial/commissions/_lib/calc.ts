export function calcCommission(input: {
  base: number
  pct: number
  splitOperator?: number
  irrfRate: number
}) {
  const splitPct = (input.splitOperator ?? 100) / 100
  const grossFull = input.base * input.pct
  const grossOperator = grossFull * splitPct
  const grossCapturer = grossFull * (1 - splitPct)
  const irrf = grossOperator * input.irrfRate
  const net = grossOperator - irrf
  return { grossFull, grossOperator, grossCapturer, irrf, net }
}
