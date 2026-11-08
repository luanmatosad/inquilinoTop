DELETE FROM payment_events WHERE kind IN ('REPORTED', 'REJECTED');
ALTER TABLE payment_events DROP CONSTRAINT payment_events_kind_check;
ALTER TABLE payment_events ADD CONSTRAINT payment_events_kind_check
    CHECK (kind IN ('SENT', 'REMINDER', 'AGREEMENT', 'PAID'));

ALTER TABLE payments
    DROP COLUMN proof_path,
    DROP COLUMN reported_date,
    DROP COLUMN reported_amount,
    DROP COLUMN reported_at;

DROP TABLE payment_links;
