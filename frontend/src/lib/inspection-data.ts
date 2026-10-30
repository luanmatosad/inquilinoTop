import { goFetch } from "@/lib/go/client"
import type { Condition } from "@/lib/inspection-schemas"

export interface Photo {
  id: string
  item_id: string
  filename: string
  mime_type: string
  size_bytes: number
}

export interface InspectionItem {
  id: string
  inspection_id: string
  room: string
  item: string
  condition: Condition
  notes?: string | null
  position: number
  photos: Photo[]
}

export interface Inspection {
  id: string
  lease_id: string
  type: "ENTRY" | "EXIT"
  status: "DRAFT" | "COMPLETED"
  inspected_at: string
  general_notes?: string | null
  completed_at?: string | null
}

export interface InspectionDetail extends Inspection {
  items: InspectionItem[]
}

export interface ComparisonRow {
  room: string
  item: string
  entry_condition: Condition | null
  exit_condition: Condition | null
  entry_notes?: string | null
  exit_notes?: string | null
  worsened: boolean
}

export interface Comparison {
  lease_id: string
  entry: Inspection
  exit: Inspection
  rows: ComparisonRow[]
}

export interface LeaseOption {
  id: string
  label: string
}

interface LeaseRow { id: string; unit_id: string; tenant_id: string; status: string }

/** Contratos com rótulo "Imóvel - Unidade · Inquilino", para selects e títulos. */
export async function getLeaseOptions(): Promise<LeaseOption[]> {
  try {
    const [leases, tenants, properties] = await Promise.all([
      goFetch<LeaseRow[]>("/api/v1/leases", {}),
      goFetch<{ id: string; name: string }[]>("/api/v1/tenants", {}),
      goFetch<{ name: string; units: { id: string; label: string }[] }[]>("/api/v1/properties", {}),
    ])
    const tenantName = new Map((tenants ?? []).map((t) => [t.id, t.name]))
    const unitLabel = new Map<string, string>()
    for (const p of properties ?? []) for (const u of p.units ?? []) unitLabel.set(u.id, `${p.name} - ${u.label}`)
    return (leases ?? []).map((l) => ({
      id: l.id,
      label: `${unitLabel.get(l.unit_id) ?? "Unidade"} · ${tenantName.get(l.tenant_id) ?? "Inquilino"}${l.status === "ACTIVE" ? "" : " (encerrado)"}`,
    }))
  } catch {
    return []
  }
}

// Datas do backend são meia-noite UTC: formatar em UTC evita voltar um dia no fuso do Brasil.
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })
