CREATE TABLE irrf_brackets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  valid_from DATE NOT NULL,
  min_base   FLOAT8 NOT NULL,
  max_base   FLOAT8,
  rate       FLOAT8 NOT NULL,
  deduction  FLOAT8 NOT NULL DEFAULT 0
);

CREATE INDEX idx_irrf_valid_from ON irrf_brackets(valid_from);

-- Tabela progressiva IRRF vigente 2025 (aplicável até nova publicação RFB)
INSERT INTO irrf_brackets (valid_from, min_base, max_base, rate, deduction) VALUES
  ('2024-02-01', 0,        2259.20, 0.0000,   0.00),
  ('2024-02-01', 2259.21,  2826.65, 0.0750, 169.44),
  ('2024-02-01', 2826.66,  3751.05, 0.1500, 381.44),
  ('2024-02-01', 3751.06,  4664.68, 0.2250, 662.77),
  ('2024-02-01', 4664.69,  NULL,    0.2750, 896.00);
