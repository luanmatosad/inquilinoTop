// frontend/e2e-bdd/pages/PaymentsPage.ts
import { Page, expect } from '@playwright/test'

export class PaymentsPage {
  constructor(private page: Page) {}

  async navegar() {
    await this.page.goto('/payments')
    await this.page.waitForLoadState('domcontentloaded')
  }

  async clicarNovoPagamento() {
    await this.page.getByRole('button', { name: /Novo Pagamento/ }).click()
    await expect(this.page.getByText('Registrar Pagamento')).toBeVisible()
  }

  async selecionarContrato(leaseId: string) {
    // Shadcn Select renders a combobox — find the one labeled "Contrato"
    const contratoLabel = this.page.getByText('Contrato (Opcional)')
    const triggerLocator = contratoLabel.locator('..').getByRole('combobox')
    await triggerLocator.click()
    await this.page.locator(`[data-value="${leaseId}"]`).click()
  }

  async selecionarTipoPagamento(tipo: string) {
    // Shadcn Select for tipo
    const tipoLabel = this.page.getByText('Tipo *')
    const triggerLocator = tipoLabel.locator('..').getByRole('combobox')
    await triggerLocator.click()
    await this.page.locator(`[data-value="${tipo}"]`).click()
  }

  async preencherDescricao(descricao: string) {
    await this.page.fill('input[name="description"]', descricao)
  }

  async preencherValor(valor: string) {
    await this.page.fill('input[name="gross_amount"]', valor)
  }

  async preencherVencimento(data: string) {
    await this.page.fill('input[name="due_date"]', data)
  }

  async submeterFormulario() {
    await this.page.getByRole('button', { name: 'Salvar' }).click()
  }

  async verificarPeloMenosUmPagamento() {
    const rows = this.page.locator('table tbody tr')
    await expect(rows).not.toHaveCount(0)
  }

  async verificarToastPagamentoRegistrado() {
    await expect(this.page.getByText(/Pagamento registrado com sucesso/i)).toBeVisible()
  }
}
