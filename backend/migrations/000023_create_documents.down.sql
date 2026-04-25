-- Migration: 000023_create_documents
-- Rollback documents table

DROP INDEX IF EXISTS idx_documents_created;
DROP INDEX IF EXISTS idx_documents_entity;
DROP INDEX IF EXISTS idx_documents_owner;
DROP TABLE IF EXISTS documents;