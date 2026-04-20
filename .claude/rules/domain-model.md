# Modelo de Domínio — InquilinoTop

Carrega em toda sessão. Define as entidades, invariantes e direção de migração do sistema.

## Hierarquia de Entidades

```
Property (RESIDENTIAL | SINGLE)
  └── Unit
        └── Lease (Tenant ↔ Unit)
              ├── Payment
              └── Expense
```

Toda entidade pertence a um `owner_id`. Nunca retornar ou modificar dados sem filtrar por `owner_id`.

## Enums

| Entidade | Campo | Valores |
|---|---|---|
| Property | type | `RESIDENTIAL`, `SINGLE` |
| Lease | status | `ACTIVE`, `ENDED`, `CANCELED` |
| Payment | status | `PENDING`, `PAID`, `LATE` |
| Payment | type | `RENT`, `DEPOSIT`, `EXPENSE`, `OTHER` |
| Expense | category | `ELECTRICITY`, `WATER`, `CONDO`, `TAX`, `MAINTENANCE`, `OTHER` |

## Invariantes

- **Soft-delete obrigatório**: deleções sempre via `is_active=false` + `updated_at=NOW()`. Nunca `DELETE FROM`.
- **SINGLE auto-cria Unit**: ao criar Property do tipo `SINGLE`, criar automaticamente uma Unit com label `"Unidade 01"`.
- **ownerID em toda query**: toda query de leitura e escrita DEVE incluir `owner_id` no filtro — sem exceção.
- **UUIDs**: todos os IDs são `uuid.UUID` no Go / `uuid` no PostgreSQL.

## Direção de Migração

O backend Go é o destino final. O Supabase é legado em processo de substituição.

- **Novas features**: implementar no Go backend primeiro.
- **Frontend**: ao migrar um domínio para o Go, remover a lógica Supabase correspondente — não manter as duas.
- **Prioridade de migração**: seguir a ordem da hierarquia de entidades (Property → Tenant → Lease → Payment → Expense).
