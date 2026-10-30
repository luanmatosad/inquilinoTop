CREATE TABLE inspection_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    room          VARCHAR(100) NOT NULL,
    item          VARCHAR(150) NOT NULL,
    condition     TEXT NOT NULL CHECK (condition IN ('GOOD', 'FAIR', 'POOR', 'DAMAGED', 'NOT_APPLICABLE')),
    notes         TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000),
    position      INTEGER NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inspection_items_inspection ON inspection_items (inspection_id) WHERE is_active;
