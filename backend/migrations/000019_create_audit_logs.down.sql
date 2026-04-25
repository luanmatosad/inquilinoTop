-- Migration: 000019_create_audit_logs
-- Rollback: drop audit_logs table

DROP TABLE IF EXISTS audit_logs CASCADE;