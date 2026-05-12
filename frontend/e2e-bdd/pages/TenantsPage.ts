// frontend/e2e-bdd/pages/TenantsPage.ts
import { Page, expect } from '@playwright/test'

export class TenantsPage {
  constructor(private page: Page) {}

  async navegar() {
    await this.page.goto('/tenants')
    await this.page.waitForLoadState('domcontentloaded')
  }

  async clicarNovoInquilino() {
    await this.page.getByRole('button', { name: /Novo Inquilino/ }).click()
    await expect(this.page.getByRole('dialog')).toBeVisible()
  }

  async preencherNome(nome: string) {
    await this.page.getByLabel('Nome Completo *').fill(nome)
  }

  async preencherEmail(email: string) {
    await this.page.getByLabel('Email').fill(email)
  }

  async submeterFormulario() {
    await this.page.getByRole('button', { name: 'Cadastrar Inquilino' }).click()
  }

  async submeterSemNome() {
    await this.page.getByRole('button', { name: 'Cadastrar Inquilino' }).click()
  }

  async verificarNaTabela(nome: string) {
    await expect(this.page.getByRole('cell', { name: nome })).toBeVisible()
  }

  async verificarToastCadastrado() {
    await expect(this.page.getByText('Inquilino criado com sucesso!')).toBeVisible()
  }

  async verificarToastStatusAlterado() {
    await expect(this.page.getByText(/desativado|ativado/i)).toBeVisible()
  }

  async verificarDialogAberto() {
    await expect(this.page.getByRole('dialog')).toBeVisible()
  }

  async desativarInquilino(nome: string) {
    const row = this.page.getByRole('row', { name: new RegExp(nome) })
    await row.getByTitle('Desativar').click()
  }
}
