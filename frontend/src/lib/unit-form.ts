import type { UnitFormValues } from "@/lib/schemas"

type UnitLike = {
  id: string
  label: string
  floor?: string | null
  notes?: string | null
  area_m2?: number | null
  reference_rent?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
}

/** Unidade da API → valores do formulário (campos numéricos viram texto, área com vírgula). */
export function unitToFormValues(unit: UnitLike): UnitFormValues & { id: string } {
  return {
    id: unit.id,
    label: unit.label,
    floor: unit.floor ?? "",
    notes: unit.notes ?? "",
    area_m2: unit.area_m2 != null ? String(unit.area_m2).replace(".", ",") : "",
    reference_rent: unit.reference_rent != null ? String(unit.reference_rent).replace(".", ",") : "",
    bedrooms: unit.bedrooms != null ? String(unit.bedrooms) : "",
    bathrooms: unit.bathrooms != null ? String(unit.bathrooms) : "",
  }
}
