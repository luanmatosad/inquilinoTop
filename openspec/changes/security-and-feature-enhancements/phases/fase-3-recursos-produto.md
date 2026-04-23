# Fase 3: Recursos do Produto

**Status:** ⏳ Pendente
**Tasks:** 14 tasks

## Ações Planejadas

### 3.1 Gerenciamento de Documentos

**Módulo:** `internal/document/`

- [ ] Criar tabela `documents`
  ```sql
  CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id),
    entity_type VARCHAR(50),  -- property, unit, lease, tenant
    entity_id UUID,
    filename VARCHAR(255),
    mime_type VARCHAR(100),
    size_bytes INT,
    file_path VARCHAR(500),  -- path no disco/S3
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```

- [ ] Criar pacote `internal/document/`
  - `model.go` - Document struct + interface Repository
  - `repository.go` - CRUD PostgreSQL
  - `service.go` - validação, storage interface
  - `handler.go` - upload/download/delete

- [ ] Implementar upload
  - Aceitar: PDF, DOC, DOCX (max 10MB)
  - Validar mime type no content-Type header
  - Salvar em disco local (ou S3 interface)

- [ ] Implementar download
  - Servir arquivo com Content-Type correto
  - Content-Disposition: attachment

### 3.2 Sistema de Notificações

**Módulo:** `internal/notification/`

- [ ] Criar tabela `notifications`
  ```sql
  CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id),
    type VARCHAR(20),  -- email, sms, push
    to_address VARCHAR(255),
    subject VARCHAR(255),
    body TEXT,
    status VARCHAR(20),  -- pending, sent, failed
    scheduled_at TIMESTAMP,
    sent_at TIMESTAMP,
    retry_count INT DEFAULT 0
  );
  ```

- [ ] Criar pacote `internal/notification/`
  - `model.go` - Notification struct
  - `repository.go`
  - `service.go` - interface EmailService
  - `email.go` - implementação SMTP
  - `queue.go` - scheduling

- [ ] Implementar templates
  - Payment reminder (vencimento em X dias)
  - Contract expiring (vencer em 30 dias)
  - Lease created

- [ ] Implementar scheduler
  - Verificar diáriosamente pagamentos vencidos
  - Enviar reminders automáticos

## Arquivos a Criar

```
backend/
├── migrations/
│   ├── 000022_create_documents.up.sql
│   └── 000023_create_notifications.up.sql
└── internal/document/     # NOVO
    ├── model.go
    ├── repository.go
    ├── service.go
    └── handler.go

internal/notification/  # NOVO
    ├── model.go
    ├── repository.go
    ├── service.go
    ├── email.go
    ├── queue.go
    └── templates/       # email templates
        ├── payment_reminder.txt
        └── contract_expiring.txt
```

## Dependências

```go
gopkg.in/gomail.v2      # SMTP email
github.com/aws/aws-sdk-go # S3 (futuro)
```

## Variáveis de Ambiente

```bash
# Storage
DOCUMENT_STORAGE_PATH=/var/data/inquilinotop/documents

# Email (SMTP)
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USERNAME=postmaster@inquilinotop.com
SMTP_PASSWORD=xxx
EMAIL_FROM=InquilinoTop <noreply@inquilinotop.com>
```