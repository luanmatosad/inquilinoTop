// frontend/e2e-bdd/pages/LeasesPage.ts
import { Page, expect } from '@playwright/test'

export class LeasesPage {
  constructor(private page: Page) {}

  async navegar() {
    await this.page.goto('/leases')
    await this.page.waitForLoadState('domcontentloaded')
  }

  async clicarNovoContrato() {
    await this.page.getByRole('button', { name: /Novo Contrato/ }).click()
    await expect(this.page.getByText('Novo Contrato de Locação')).toBeVisible()
  }

  async selecionarUnidade(unitId: string) {
    // Shadcn Select renders a combobox — find the one labeled "Unidade"
    const unidadeLabel = this.page.getByText('Unidade *')
    const triggerLocator = unidadeLabel.locator('..').getByRole('combobox')
    await triggerLocator.click()
    // Click the option whose value matches unitId (SelectItem renders with data-value)
    await this.page.locator(`[data-value="${unitId}"]`).click()
  }

  async selecionarInquilino(tenantId: string) {
    // Shadcn Select renders a combobox — find the one labeled "Inquilino"
    const inquilinoLabel = this.page.getByText('Inquilino *')
    const triggerLocator = inquilinoLabel.locator('..').getByRole('combobox')
    await triggerLocator.click()
    await this.page.locator(`[data-value="${tenantId}"]`).click()
  }

  async preencherDataInicio(data: string) {
    await this.page.fill('input[name="start_date"]', data)
  }

  async preencherValorAluguel(valor: string) {
    await this.page.fill('input[name="rent_amount"]', valor)
  }

  async preencherDiaPagamento(dia: string) {
    await this.page.fill('input[name="payment_day"]', dia)
  }

  async submeterFormulario() {
    await this.page.getByRole('button', { name: 'Criar Contrato' }).click()
  }

  async verificarPeloMenosUmContrato() {
    const rows = this.page.locator('table tbody tr')
    await expect(rows).not.toHaveCount(0)
  }

  async verificarToastCriado() {
    await expect(this.page.getByText(/contrato criado com sucesso/i)).toBeVisible()
  }

  async navegarParaUnidade(unitId: string) {
    await this.page.goto(`/units/${unitId}`)
    await this.page.waitForLoadState('domcontentloaded')
  }

  async encerrarContratoNaUnidade() {
    // "Encerrar Contrato" button triggers AlertDialog on unit detail page
    await this.page.getByRole('button', { name: /Encerrar Contrato/ }).click()
    await expect(this.page.getByRole('alertdialog')).toBeVisible()
    await this.page.getByRole('button', { name: /Confirmar Encerramento/ }).click()
  }

  async verificarToastEncerrado() {
    await expect(this.page.getByText(/contrato encerrado com sucesso/i)).toBeVisible()
  }
}
