ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_tipo_check;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_tipo_check
    CHECK (tipo IN ('duvida', 'sugestao', 'reclamacao', 'outro'));
