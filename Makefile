COMPOSE = docker compose
BACKEND  = $(COMPOSE) exec backend
FRONTEND = $(COMPOSE) exec frontend
DB       = $(COMPOSE) exec postgres

.DEFAULT_GOAL := help

# ── Setup ────────────────────────────────────────────────────────────────────

.PHONY: setup
setup: ## Cria .env e verifica pré-requisitos
	@docker compose version > /dev/null 2>&1 || (echo "ERRO: docker compose não encontrado. Instale o plugin." && exit 1)
	@if ! getent group docker | grep -q "\b$${USER}\b"; then \
		echo "AVISO: usuário não está no grupo docker. Execute: sudo usermod -aG docker \$$USER && newgrp docker"; \
	fi
	@if [ ! -f .env ]; then cp .env.example .env && echo ".env criado — preencha as variáveis"; fi

.PHONY: keys
keys: ## Gera par de chaves RSA para o backend (JWT)
	mkdir -p backend/keys
	openssl genrsa -out backend/keys/private.pem 2048
	openssl rsa -in backend/keys/private.pem -pubout -out backend/keys/public.pem
	@echo "Chaves geradas em backend/keys/"

# ── Dev ──────────────────────────────────────────────────────────────────────

.PHONY: up
up: ## Sobe todos os serviços em background
	$(COMPOSE) up -d

.PHONY: up-build
up-build: ## Reconstrói imagens e sobe todos os serviços
	$(COMPOSE) up -d --build

.PHONY: down
down: ## Para e remove os containers
	$(COMPOSE) down

.PHONY: restart
restart: down up ## Para e reinicia todos os serviços

.PHONY: ps
ps: ## Lista containers e status
	$(COMPOSE) ps

.PHONY: build
build: ## Constrói todas as imagens sem subir
	$(COMPOSE) build

# ── Logs ─────────────────────────────────────────────────────────────────────

.PHONY: logs
logs: ## Exibe logs de todos os serviços (Ctrl+C para sair)
	$(COMPOSE) logs -f

.PHONY: logs-backend
logs-backend: ## Exibe logs do backend Go
	$(COMPOSE) logs -f backend

.PHONY: logs-frontend
logs-frontend: ## Exibe logs do frontend Next.js
	$(COMPOSE) logs -f frontend

.PHONY: logs-db
logs-db: ## Exibe logs do PostgreSQL
	$(COMPOSE) logs -f postgres

# ── Banco de dados ────────────────────────────────────────────────────────────

.PHONY: db-shell
db-shell: ## Abre o psql no banco de desenvolvimento
	$(DB) psql -U postgres -d inquilinotop

.PHONY: db-shell-test
db-shell-test: ## Abre o psql no banco de testes
	$(COMPOSE) exec postgres_test psql -U postgres -d inquilinotop_test

# ── Backend ───────────────────────────────────────────────────────────────────

.PHONY: backend-shell
backend-shell: ## Abre shell no container do backend
	$(BACKEND) sh

.PHONY: test-backend
test-backend: ## Roda testes unitários do backend (sem DB)
	$(BACKEND) go test ./pkg/... ./internal/identity/... -run "TestService|TestHandler|TestSign|TestVerify|TestMiddleware|TestOK|TestErr" -v

.PHONY: test-backend-integration
test-backend-integration: ## Roda todos os testes do backend (requer DB)
	$(BACKEND) go test ./... -v

.PHONY: build-backend
build-backend: ## Compila o binário do backend
	$(BACKEND) go build -o ./tmp/main ./cmd/api/

# ── Frontend ──────────────────────────────────────────────────────────────────

.PHONY: frontend-shell
frontend-shell: ## Abre shell no container do frontend
	$(FRONTEND) sh

.PHONY: frontend-install
frontend-install: ## Instala dependências do frontend dentro do container
	$(FRONTEND) npm install

.PHONY: frontend-lint
frontend-lint: ## Roda ESLint no frontend
	$(FRONTEND) npm run lint

.PHONY: build-frontend
build-frontend: ## Gera build de produção do frontend
	$(FRONTEND) npm run build

# ── Produção ──────────────────────────────────────────────────────────────────

.PHONY: build-prod
build-prod: ## Constrói imagens de produção (Dockerfile padrão)
	docker build -t inquilinotop-backend ./backend
	docker build -t inquilinotop-frontend ./frontend

# ── Limpeza ───────────────────────────────────────────────────────────────────

.PHONY: clean
clean: ## Remove containers, volumes e imagens do projeto
	$(COMPOSE) down -v --rmi local

.PHONY: prune
prune: ## Remove todos os recursos Docker não utilizados no sistema
	docker system prune -f

# ── Utilitários ───────────────────────────────────────────────────────────────

.PHONY: open
open: ## Abre o frontend no navegador padrão
	xdg-open http://localhost:3000

.PHONY: open-backend
open-backend: ## Abre o health check do backend no navegador
	xdg-open http://localhost:8080/health

.PHONY: help
help: ## Exibe esta ajuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-22s\033[0m %s\n", $$1, $$2}'
