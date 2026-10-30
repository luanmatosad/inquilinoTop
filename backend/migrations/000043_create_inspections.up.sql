CREATE TABLE inspections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lease_id        UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    type            TEXT NOT NULL CHECK (type IN ('ENTRY', 'EXIT')),
    status          TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'COMPLETED')),
    inspected_at    DATE NOT NULL,
    general_notes   TEXT CHECK (general_notes IS NULL OR char_length(general_notes) <= 4000),
    completed_at    TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT inspections_completed_consistent CHECK (
        (status = 'COMPLETED' AND completed_at IS NOT NULL) OR
        (status = 'DRAFT' AND completed_at IS NULL)
    )
);

CREATE INDEX idx_inspections_org ON inspections (organization_id, is_active);
CREATE INDEX idx_inspections_lease ON inspections (lease_id);

-- Um laudo ativo por tipo em cada contrato (uma entrada e uma saída).
CREATE UNIQUE INDEX uq_inspections_lease_type_active
    ON inspections (lease_id, type) WHERE is_active;
