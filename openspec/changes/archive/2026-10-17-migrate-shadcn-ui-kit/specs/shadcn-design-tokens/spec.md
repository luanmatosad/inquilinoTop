## ADDED Requirements

### Requirement: Tokens de design centralizados via CSS variables
O sistema SHALL definir cores, radius, spacing e tipografia como CSS variables em `src/app/globals.css`, extraídos do UI Kit Shadcn no Figma, substituindo quaisquer valores de tema vindos de HeroUI.

#### Scenario: Componente consome token de cor
- **WHEN** um componente Shadcn referencia uma cor de tema (ex: `bg-primary`)
- **THEN** o valor resolve para a CSS variable definida em `globals.css`, consistente com o token correspondente no kit Figma

#### Scenario: Nenhum valor de tema hardcoded em componente
- **WHEN** um novo componente é adicionado a `src/components/ui/*`
- **THEN** cores, radius e spacing de tema são referenciados via CSS variable/Tailwind token, nunca como valor hexadecimal ou px fixo inline

### Requirement: Remoção dos tokens HeroUI
O sistema SHALL remover qualquer configuração de tema vinda de `@heroui/react`/`@heroui/styles` após a migração ser concluída.

#### Scenario: Build sem dependência HeroUI
- **WHEN** o projeto é compilado após a migração completa
- **THEN** `package.json` não contém `@heroui/react` nem `@heroui/styles`, e nenhum import dessas libs existe no código
