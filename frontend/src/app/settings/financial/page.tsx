import { redirect } from 'next/navigation'

// O Pix agora vive em /settings/pix; o endereço antigo só redireciona. Provedor, Asaas e dados bancários saíram da
// tela (o backend continua com eles e os valores gravados não mudam).
export default function FinancialSettingsRedirect() {
  redirect('/settings/pix')
}
