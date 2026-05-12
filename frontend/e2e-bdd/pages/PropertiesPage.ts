// frontend/e2e-bdd/pages/PropertiesPage.ts
import { Page, expect } from '@playwright/test'

export class PropertiesPage {
  constructor(private page: Page) {}

  async navegarParaLista() {
    await this.page.goto('/properties')
    await this.page.waitForLoadState('networkidle')
  }

  async clicarNovoImovel() {
    await this.page.getByRole('link', { name: /Novo Imóvel/ }).click()
    await this.page.waitForURL(/\/properties\/new/)
  }

  async preencherNome(nome: string) {
    await this.page.getByLabel('Nome do Imóvel').fill(nome)
  }

  async selecionarTipo(tipo: 'SINGLE' | 'RESIDENTIAL') {
    const labels = { SINGLE: 'Único (Casa/Loja)', RESIDENTIAL: 'Residencial (Prédio/Condomínio)' }
    await this.page.getByRole('combobox').click()
    await this.page.getByRole('option', { name: labels[tipo] }).click()
  }

  async submeterFormulario() {
    await this.page.getByRole('button', { name: 'Criar Imóvel' }).click()
  }

  async submeterFormularioSemNome() {
    await this.page.getByRole('button', { name: 'Criar Imóvel' }).click()
  }

  async verificarNaLista(nome: string) {
    await expect(this.page.getByText(nome)).toBeVisible()
  }

  async verificarAusenteNaLista(nome: string) {
    await expect(this.page.getByText(nome)).not.toBeVisible()
  }

  async verificarToastCriado() {
    await expect(this.page.getByText('Imóvel criado com sucesso')).toBeVisible()
  }

  async verificarRedirecionadoParaImovel() {
    await this.page.waitForURL(/\/properties\/[a-f0-9-]+/)
  }

  async verificarFormularioNaoSubmetido() {
    expect(this.page.url()).toContain('/properties/new')
  }

  async navegarParaImovel(nome: string) {
    await this.page.goto('/properties')
    await this.page.waitForLoadState('networkidle')
    await this.page.getByText(nome).click()
    await this.page.waitForURL(/\/properties\/[a-f0-9-]+/)
  }

  async excluirImovel() {
    await this.page.getByRole('button', { name: 'Desativar' }).click()
    const confirmar = this.page.getByRole('button', { name: 'Confirmar' })
    if (await confirmar.isVisible()) {
      await confirmar.click()
    }
  }
}
