# 0002 - Abstração multi-provider (PaymentProvider)

**Status**: Accepted

## Context

Cobranças de aluguel (PIX/Boleto) e repasses dependem de instituições financeiras externas. O sistema precisa suportar mais de um banco/gateway (hoje: Asaas, Sicoob, Bradesco, Itaú, além de um `mock` para testes), e diferentes owners podem preferir provedores diferentes.

## Decision

Interface `PaymentProvider` (`internal/payment/provider/`) com os métodos `CreatePIXCharge`, `CreateBoletoCharge`, `GetChargeStatus`, `CreatePayout`, `RegisterWebhook`, `GetProviderName` — cada banco implementa a interface. Seleção via factory `provider.NewProvider(providerType, config)`, passando a string do provider (`"asaas"|"sicoob"|"bradesco"|"itau"|"mock"`) e config específica.

## Consequences

- Adicionar um banco novo é implementar a interface + registrar na factory — não precisa tocar em `service.go` do domínio `payment`
- Cada provider tem particularidades de autenticação/token que ficam encapsuladas na própria implementação (ex: `bradesco` usa `sync.Mutex` no cache de token — concorrência tratada localmente, não exposta pela interface)
- `provider.NewProvider` recebendo a string do tipo em vez de um enum Go significa que erros de digitação na config só aparecem em runtime, não em compile-time — mitigado pelo provider `mock` cobrindo os testes
- Webhooks de providers diferentes (`POST /api/v1/payments/webhook`) convergem num único endpoint — o roteamento pro provider correto depende do payload recebido, não da URL
