-- Migration: 000062_notifications_failed_status
-- Status válidos passam a incluir 'failed' (notificação que atingiu o limite de retry).

ALTER TABLE notifications
    ADD CONSTRAINT notifications_status_check
    CHECK (status IN ('pending', 'sent', 'failed'));
