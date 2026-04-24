-- Migration: 000024_create_notifications
-- Rollback notifications table

DROP INDEX IF EXISTS idx_notifications_scheduled;
DROP INDEX IF EXISTS idx_notifications_status;
DROP INDEX IF EXISTS idx_notifications_owner;
DROP TABLE IF EXISTS notifications;