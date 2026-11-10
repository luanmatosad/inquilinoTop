# reports-by-property Specification

## Purpose
TBD - created by archiving change relatorios-visao-geral. Update Purpose after archive.
## Requirements
### Requirement: Resultado por unidade
O sistema SHALL calcular, para um ano e por organização, o recebido, as despesas e o resultado de cada unidade, com a mesma base e o mesmo período do hub, mostrando só unidades com movimento, em ordem decrescente de resultado, e o total.

#### Scenario: Duas unidades
- **WHEN** uma unidade recebeu 1.850 e gastou 300 e outra recebeu 1.000 sem gastos
- **THEN** a primeira tem resultado 1.550, a segunda 1.000, e o total recebido é 2.850

### Requirement: Tela e planilha
O frontend SHALL mostrar em `/reports/por-imovel` a tabela "Unidade · Imóvel", Recebido, Despesas e Resultado com total (cards no celular) e oferecer **Exportar planilha**, que baixa um CSV (UTF-8 com BOM, separador `;`, vírgula decimal) com as mesmas linhas.

#### Scenario: Exportar
- **WHEN** o dono escolhe Exportar planilha
- **THEN** baixa `resultado-por-imovel-AAAA.csv` com as linhas e o total

#### Scenario: Imóveis indisponíveis
- **WHEN** a lista de imóveis falha
- **THEN** a tabela mostra "—" no lugar do rótulo e os valores continuam

