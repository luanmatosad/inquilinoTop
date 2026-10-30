CREATE TABLE inspection_photos (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_item_id UUID NOT NULL REFERENCES inspection_items(id) ON DELETE CASCADE,
    filename           VARCHAR(255) NOT NULL,
    mime_type          TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
    size_bytes         INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
    file_path          VARCHAR(500) NOT NULL,
    uploaded_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active          BOOLEAN NOT NULL DEFAULT true,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inspection_photos_item ON inspection_photos (inspection_item_id) WHERE is_active;
