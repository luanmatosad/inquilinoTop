DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM support_tickets WHERE organization_id IS NULL) THEN
        RAISE EXCEPTION 'support_tickets tem tickets sem organização; remova-os antes de reverter a 000063';
    END IF;
END $$;

ALTER TABLE support_tickets ALTER COLUMN organization_id SET NOT NULL;
