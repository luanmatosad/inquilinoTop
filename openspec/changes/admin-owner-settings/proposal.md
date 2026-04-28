## Why

O módulo financeiro do painel de administração do proprietário ("owner admin") foi finalizado. O objetivo agora é mapear, planejar e configurar os demais módulos e configurações pendentes para o proprietário, garantindo que ele tenha controle total sobre suas propriedades, inquilinos, contratos e manutenção no sistema InquilinoTop.

## What Changes

- **Gestão de Imóveis**: Cadastro, edição e visualização do status dos imóveis associados ao proprietário.
- **Gestão de Inquilinos**: Visão detalhada de inquilinos associados aos imóveis do proprietário.
- **Gestão de Contratos**: Gerenciamento de vigências, renovações e status de locação.
- **Painel de Configurações Gerais**: Ajustes de perfil, notificações e preferências de conta do proprietário.

## Capabilities

### New Capabilities
- `property-management`: Cadastro, edição e acompanhamento do portfólio de imóveis do proprietário.
- `tenant-management`: Acesso a informações, histórico e status de inquilinos vinculados ao proprietário.
- `contract-management`: Gerenciamento e acompanhamento de vigências e dados dos contratos de locação.
- `owner-preferences`: Configurações de perfil, preferências de notificações e segurança da conta do proprietário.

### Modified Capabilities
- N/A

## Impact

- **Frontend**: Criação e atualização de views no dashboard do proprietário (`src/app/(dashboard)/owner/*` ou similar) e integração dos componentes de formulário/tabelas.
- **Backend/DB**: Criação/Ajuste de tabelas de imóveis, inquilinos, contratos no Supabase ou via Backend em Go (se existir a necessidade de lógica complexa, embora o acesso principal tenda a ser Supabase para as áreas não-auth).
