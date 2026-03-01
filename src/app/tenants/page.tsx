import { createClient } from '@/lib/supabase/server'
import { TenantListClient } from '@/components/tenants/TenantListClient'

export default async function TenantsPage() {
  const supabase = await createClient()

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching tenants:', error)
    return <div>Erro ao carregar inquilinos. Tente recarregar a página.</div>
  }

  return (
    <div className="container py-10">
      <TenantListClient tenants={tenants || []} />
    </div>
  )
}
