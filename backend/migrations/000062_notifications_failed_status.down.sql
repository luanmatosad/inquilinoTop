-- Migration: 000062_notifications_failed_status
-- Rollback do check de status. Notificações 'failed' precisam ser reprocessadas ou removidas antes.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_status_check;
