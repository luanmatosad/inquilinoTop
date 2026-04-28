## Context

Atualmente o sistema possui o módulo financeiro concluído para o proprietário. Precisamos agora expandir as capacidades do painel de administração (`owner admin`) para incluir a gestão de imóveis, inquilinos, contratos e configurações do perfil. A arquitetura atual para acesso a dados no dashboard e nas visualizações de domínio é feita primariamente consultando o Supabase de forma direta via camadas DAL (Data Access Layer), uma vez que apenas `identity/auth` foi migrado para o backend em Go até o momento.

## Goals / Non-Goals

**Goals:**
- Projetar as interfaces e a estrutura de dados (ou utilizar a existente no Supabase) para Imóveis, Inquilinos, Contratos e Preferências do Proprietário.
- Garantir que todas as consultas e mutações de dados no frontend usem funções encapsuladas no DAL (`src/data/owner/*` ou similar).
- Reutilizar componentes de UI existentes (tabelas, formulários, modais) do módulo financeiro ou biblioteca de design do projeto.

**Non-Goals:**
- Não migrar estes fluxos para o backend em Go neste momento; manteremos o padrão de acesso direto via Supabase Client no frontend para estas entidades (a menos que a regra de negócio exija).
- Não alterar a modelagem de dados do financeiro.

## Decisions

- **Acesso a Dados**: Continuaremos utilizando chamadas diretas ao Supabase via Client no Frontend (usando `@supabase/ssr` ou `@supabase/supabase-js` dependendo do ambiente e de server actions/hooks no Next.js).
- **Estrutura de Pastas de Dados**: Criar arquivos DAL dedicados para cada entidade sob a pasta `src/data/owner/` (ex: `properties-dal.ts`, `tenants-dal.ts`, `contracts-dal.ts`).
- **Páginas e Roteamento**: As páginas serão criadas dentro de `src/app/(dashboard)/owner/` (ex: `/owner/properties`, `/owner/tenants`, `/owner/contracts`, `/owner/settings`).
- **Componentização**: Utilizar componentes de UI (shadcn/ui ou componentes baseados em Tailwind) existentes para manter a coesão visual com o módulo financeiro.

## Risks / Trade-offs

- **Risk: Duplicação de lógica** → *Mitigação*: Encapsular regras de negócio estritas (ex: relacionar um inquilino e um imóvel a um contrato) em funções de serviço no frontend ou através de *Triggers/RLS* no banco Supabase para evitar inconsistências.
- **Risk: Segurança dos Dados (RLS)** → *Mitigação*: Garantir que Row Level Security (RLS) no Supabase esteja configurada para que um proprietário (`owner`) só consiga ler, atualizar ou excluir dados que pertençam a ele (onde `owner_id = auth.uid()`).
