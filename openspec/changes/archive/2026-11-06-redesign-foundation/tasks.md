## 1. Baseline e limpeza

- [x] 1.1 Rodar `make frontend-lint` e a suíte Vitest no estado atual (shell sem commit) e registrar o que falha
- [x] 1.2 Mover o trabalho do shell para um branch próprio (`feat/redesign-foundation`). Criado a partir do HEAD de `feat/add-laudo-vistoria`, não de `main`: `main` não tem financeiro nem as fontes self-hosted que o shell usa, e o git recusa a troca por conflito. O histórico de Laudos vem junto até esse branch ser mergeado
- [x] 1.3 Corrigir apenas as falhas de 1.1 que bloqueiam o shell
- [x] 1.4 Conferir `package.json`: listar dependências adicionadas (`next-themes`, `cmdk`, fontes) e confirmar que todas são usadas

## 2. Tokens e tipografia (spec design-tokens)

- [x] 2.1 Escrever teste que lê `globals.css` e confere os valores-chave do tema claro e escuro (background, primary, accent, secondary, success, warning)
- [x] 2.2 Atualizar `:root` e `.dark` em `globals.css` com os valores do `tokens.json`, incluindo `--success` e `--warning`
- [x] 2.3 Registrar `--color-success` e `--color-warning` (e foregrounds, se houver) no bloco `@theme inline`
- [x] 2.4 Adicionar a fonte Space Mono self-hosted e trocar `--font-mono` no `layout.tsx` (remover Geist Mono se nada mais usa)
- [x] 2.5 Confirmar que o toggle de tema alterna a classe `dark` e que a escolha persiste após recarregar
- [x] 2.6 Anotar no `design.md` ou em issue a pendência do contraste do `ring` escuro (2,8:1), sem alterar o valor

## 3. Componentes de UI do shell

- [x] 3.1 Comparar `ui/sidebar`, `ui/sheet`, `ui/command`, `ui/tooltip`, `ui/kbd` e `ui/theme-toggle` com as versões do `shadcnds` e listar divergências
- [x] 3.2 Registrar cada divergência, sem reestilizar na mesma tarefa. Resultado: nenhuma, os 6 arquivos são idênticos ao `shadcnds`
- [x] 3.3 Conferir os imports de `cn` (`@/lib/utils`) em todos eles

## 4. Navegação (spec app-shell-navigation)

- [x] 4.1 Atualizar `nav.test.ts` com a nova lista: 3 grupos e ordem, ausência de Laudos/Importar/Documentos/Fechamento, item ativo para `/properties/abc`
- [x] 4.2 Reescrever `lib/nav.ts` com os 9 itens da sidebar do canvas e o mapeamento rota da decisão 6 do design, marcando as 4 abas da barra inferior
- [x] 4.3 Remover Laudos e Importar de `navGroups` e da paleta; `commandGroups` mantém as subpáginas de Configurações e de Suporte, que continuam existindo como rotas
- [x] 4.4 Atualizar `Sidebar.test.tsx` para os 9 itens e 3 grupos. O cabeçalho (organização e plano) e o rodapé (usuário) já existem em `Sidebar.tsx`
- [x] 4.5 Atualizar `CommandPalette` e seu teste: busca "inquil" leva a `/tenants`, busca "laudo" não retorna nada

## 5. Shell e mobile

- [x] 5.1 Escrever teste do `AppShell`: rota pública sem shell, com sessão com sidebar e topbar, sem ramo de visitante
- [x] 5.2 Remover os ramos de visitante: o "Entrar" do `Header` (que passa a só envolver o `TopBar`) e o ramo `!sidebar` do `AppShell`. `Sidebar` é a sidebar real e fica; não há nada a apagar
- [x] 5.3 Implementar a barra inferior mobile (Hoje, Imóveis, Inquilinos, Receber, Mais) e a tela/sheet "Mais" conforme `M-Mais.dc.html`, usando `use-mobile` e `ui/sheet`
- [x] 5.4 Testar a navegação mobile: sidebar fixa ausente em 390px, cinco abas, "Mais" lista os itens do canvas e Sair

## 6. Placeholders

- [x] 6.1 Criar o componente `ComingSoon` só com `ui/*` existentes
- [x] 6.2 Criar as páginas `/reports` e `/integrations` usando `ComingSoon`, sem chamadas à API
- [x] 6.3 Confirmar no `middleware.ts` que essas rotas exigem sessão

## 7. Verificação

- [x] 7.1 Rodar `make frontend-lint` e a suíte Vitest completa; tudo verde
- [x] 7.2 Subir `make up` e percorrer, no navegador, o desktop e o celular (390px) nos temas claro e escuro: Hoje, Imóveis, Inquilinos, Contratos, Configurações
- [x] 7.3 Revisar visualmente as telas já migradas (dashboard, listas, laudos) no tema escuro por causa da troca de `primary` e `secondary`
- [x] 7.4 Atualizar `frontend/CLAUDE.md` e o comentário de `nav.ts` com a nova navegação
