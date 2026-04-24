CREATE TABLE index_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    index_type VARCHAR(10) NOT NULL, -- IPCA, IGP-M
    reference_month DATE NOT NULL,
    value DECIMAL(10,4) NOT NULL,
    cumulative DECIMAL(10,4) NOT NULL, -- acumulado 12 meses
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index para buscas eficientes
CREATE INDEX idx_index_values_type_month ON index_values (index_type, reference_month);
