-- Tokens de convite passam a ser guardados como SHA-256 hex (mesmo padrão de refresh_tokens.token_hash).
-- O código novo faz hash do token recebido antes de consultar: link já enviado continua válido,
-- porque sha256(token_bruto) é exatamente o valor gravado aqui.
UPDATE organization_invites
SET token = encode(sha256(convert_to(token, 'UTF8')), 'hex');
