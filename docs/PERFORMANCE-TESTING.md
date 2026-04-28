# Performance & Load Testing

Guia para validar performance e capacidade do sistema antes do lançamento.

## Requisitos

### k6 (Load Testing)
```bash
# macOS
brew install k6

# Linux
sudo apt-get install k6

# Windows
choco install k6

# Docker
docker run -i loadimpact/k6 run - < scripts/load-test.js
```

### Lighthouse (Chrome DevTools)
Integrado no Chrome — abrir DevTools → Lighthouse tab

## Load Testing com k6

### O que testa?

- **Stage 1 (30s):** Ramp-up para 10 usuários
- **Stage 2 (1m):** Ramp-up para 50 usuários
- **Stage 3 (2m):** Manter 50 usuários simultâneos
- **Stage 4 (30s):** Ramp-down para 0

**Endpoints testados:**
- GET `/health` — Health check
- GET `/api/v1/properties` — Listar imóveis
- GET `/api/v1/properties/{id}` — Detalhe de imóvel
- GET `/api/v1/leases` — Listar contratos
- GET `/api/v1/payments` — Listar pagamentos
- GET `/metrics` — Prometheus metrics

### Rodar teste

```bash
# Com dados padrão (localhost, admin@example.com / password)
k6 run scripts/load-test.js

# Com dados customizados
k6 run scripts/load-test.js \
  --env BASE_URL=https://sua-api.com \
  --env LOGIN_EMAIL=seu@email.com \
  --env LOGIN_PASSWORD=sua-senha

# Modo verbose (mais detalhes)
k6 run scripts/load-test.js -v

# Output em arquivo
k6 run scripts/load-test.js \
  --out json=test-results/load-test.json
```

### Interpretar resultados

```
✓ http_req_duration: avg=245ms, p(95)=480ms, p(99)=950ms
✓ http_req_failed: rate=0.8%
✓ errors: rate=0.0%
✓ http_requests_total: 3450

OK — todos os thresholds passaram
FAIL — algum threshold foi violado
```

**Thresholds definidos em `load-test.js`:**
- P95 latency < 500ms ✅
- P99 latency < 1s ✅
- Error rate < 10% ✅

Se algum falhar, o teste falha.

## Performance Testing com Lighthouse

### No Chrome DevTools

1. Abrir DevTools (F12)
2. Abrir aba "Lighthouse"
3. Selecionar:
   - Device: Mobile (recomendado)
   - Categories: Performance, Accessibility, Best Practices, SEO
4. Clicar "Analyze page load"

### Métricas importantes

- **First Contentful Paint (FCP):** < 1.5s
- **Largest Contentful Paint (LCP):** < 2.5s
- **Cumulative Layout Shift (CLS):** < 0.1
- **Speed Index:** < 3s

### Usando PageSpeed Insights

```
https://pagespeed.web.dev/
```

1. Cole seu URL
2. Analisa desktop + mobile
3. Dá pontuação 0-100
4. Lista oportunidades de melhoria

## Core Web Vitals

### Medir em produção

```javascript
// Adicionar ao seu frontend (opcional)
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

getCLS(console.log) // Cumulative Layout Shift
getFID(console.log) // First Input Delay
getFCP(console.log) // First Contentful Paint
getLCP(console.log) // Largest Contentful Paint
getTTFB(console.log) // Time to First Byte
```

### Metas (2024)

| Métrica | Bom | Precisa Melhorar |
|---|---|---|
| **LCP** | < 2.5s | > 4s |
| **FID/INP** | < 100ms | > 500ms |
| **CLS** | < 0.1 | > 0.25 |

## Teste de Responsividade

Veja `docs/RESPONSIVENESS-CHECKLIST.md` para checklist completo.

```bash
# Testar com Playwright (multi-browser, multi-device)
npm run test:e2e
```

## Teste de Capacidade (Stress Test)

Para testar além da carga nominal:

```javascript
// scripts/stress-test.js
export const options = {
  stages: [
    { duration: '5m', target: 100 },   // 100 usuários
    { duration: '5m', target: 200 },   // 200 usuários
    { duration: '2m', target: 0 },     // Ramp-down
  ],
}
```

```bash
k6 run scripts/stress-test.js
```

## Monitoramento Contínuo

Em produção com Dokploy:

```bash
# Ver métricas em tempo real
curl https://seu-dominio.com/metrics | grep http_request_duration_seconds

# Integrar com Prometheus
# Adicionar em prometheus.yml:
# - job_name: 'inquilinotop'
#   static_configs:
#   - targets: ['https://seu-dominio.com:9090']
```

## Checklist Pré-Produção

- [ ] Rodei `k6 run scripts/load-test.js` → todos os thresholds passaram
- [ ] Rodei load test em produção antes do lançamento
- [ ] Lighthouse score >= 90 (Performance, Accessibility, Best Practices, SEO)
- [ ] Core Web Vitals todos "Green"
- [ ] Responsiveness checklist completo (mobile, tablet, desktop)
- [ ] Sem console errors em DevTools
- [ ] API response time < 500ms em p95
- [ ] Database queries otimizadas (indexes, N+1 queries eliminadas)
- [ ] Imagens otimizadas (WebP, lazy loading)
- [ ] CSS/JS minificado
- [ ] Caching headers configurados

## Depois do Lançamento

- [ ] Monitorar Core Web Vitals em Google Analytics
- [ ] Monitorar erros 5xx em logs (Sentry, DataDog, etc.)
- [ ] Monitorar latência de API em `/metrics`
- [ ] Monitorar CPU/memória em Dokploy
- [ ] Monitorar uptime (UptimeRobot, Pingdom)

## Recursos

- [k6 Documentation](https://k6.io/docs/)
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [WebPageTest](https://www.webpagetest.org/)
- [Web Vitals](https://web.dev/vitals/)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
