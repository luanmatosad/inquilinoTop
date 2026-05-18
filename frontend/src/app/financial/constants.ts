export type PayableCategory =
  | 'REPAIR_HYDRAULIC' | 'REPAIR_ELECTRIC' | 'PAINT' | 'CLEAN'
  | 'PEST' | 'FURNITURE' | 'CONDO' | 'IPTU' | 'TAX' | 'OTHER'

export const PAYABLE_CATEGORY_LABELS: Record<PayableCategory, string> = {
  REPAIR_HYDRAULIC: 'Reparo hidráulico',
  REPAIR_ELECTRIC:  'Reparo elétrico',
  PAINT:            'Pintura',
  CLEAN:            'Limpeza',
  PEST:             'Dedetização',
  FURNITURE:        'Reparo de móveis',
  CONDO:            'Condomínio',
  IPTU:             'IPTU',
  TAX:              'Imposto / carnê-leão',
  OTHER:            'Outras despesas',
}
