package document

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/google/uuid"
)

type Service struct {
	repo    Repository
	storage Storage
}

func NewService(repo Repository, storage Storage) *Service {
	return &Service{repo: repo, storage: storage}
}

type localStorage struct {
	basePath string
}

func NewLocalStorage(basePath string) Storage {
	return &localStorage{basePath: basePath}
}

func (s *localStorage) Save(ctx context.Context, ownerID uuid.UUID, filename string, r io.Reader) (string, error) {
	dir := filepath.Join(s.basePath, ownerID.String())
	if err := os.MkdirAll(dir, 0750); err != nil {
		return "", fmt.Errorf("document.storage: mkdir: %w", err)
	}

	ext := filepath.Ext(filename)
	newFilename := fmt.Sprintf("%s%s", uuid.New().String(), ext)
	relPath := filepath.Join(ownerID.String(), newFilename)
	fpath := filepath.Join(s.basePath, relPath)

	f, err := os.Create(fpath)
	if err != nil {
		return "", fmt.Errorf("document.storage: create: %w", err)
	}
	defer f.Close()

	if _, err := io.Copy(f, r); err != nil {
		os.Remove(fpath)
		return "", fmt.Errorf("document.storage: copy: %w", err)
	}
	return relPath, nil
}

func (s *localStorage) Load(ctx context.Context, path string) (io.ReadCloser, error) {
	fullPath := filepath.Join(s.basePath, path)
	f, err := os.Open(fullPath)
	if err != nil {
		return nil, fmt.Errorf("document.storage: open: %w", err)
	}
	return f, nil
}

func (s *localStorage) Delete(ctx context.Context, path string) error {
	fullPath := filepath.Join(s.basePath, path)
	if err := os.Remove(fullPath); err != nil {
		return fmt.Errorf("document.storage: remove: %w", err)
	}
	return nil
}

var allowedMimeTypes = map[string]bool{
	"application/pdf":         true,
	"application/msword":     true,
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
}

func (s *Service) Upload(ctx context.Context, ownerID uuid.UUID, in CreateDocumentInput, file io.Reader) (*Document, error) {
	if !allowedMimeTypes[in.MimeType] {
		return nil, fmt.Errorf("document.svc: tipo de arquivo não permitido")
	}
	if in.SizeBytes > 10*1024*1024 {
		return nil, fmt.Errorf("document.svc: arquivo excede 10MB")
	}

	filePath, err := s.storage.Save(ctx, ownerID, in.Filename, file)
	if err != nil {
		return nil, err
	}

	doc, err := s.repo.Create(ctx, ownerID, in, filePath)
	if err != nil {
		s.storage.Delete(ctx, filePath)
		return nil, err
	}
	return doc, nil
}

func (s *Service) Download(ctx context.Context, id, ownerID uuid.UUID) (io.ReadCloser, string, error) {
	doc, err := s.repo.GetByID(ctx, id, ownerID)
	if err != nil {
		return nil, "", err
	}
	rc, err := s.storage.Load(ctx, doc.FilePath)
	if err != nil {
		return nil, "", err
	}
	return rc, doc.MimeType, nil
}

func (s *Service) GetDocument(ctx context.Context, id, ownerID uuid.UUID) (*Document, error) {
	return s.repo.GetByID(ctx, id, ownerID)
}

func (s *Service) LoadFile(ctx context.Context, path string) (io.ReadCloser, error) {
	return s.storage.Load(ctx, path)
}

func (s *Service) ListByEntity(ctx context.Context, ownerID uuid.UUID, entityType string, entityID uuid.UUID) ([]Document, error) {
	return s.repo.ListByEntity(ctx, ownerID, entityType, entityID)
}

func (s *Service) Delete(ctx context.Context, id, ownerID uuid.UUID) error {
	doc, err := s.repo.GetByID(ctx, id, ownerID)
	if err != nil {
		return err
	}
	if err := s.repo.Delete(ctx, id, ownerID); err != nil {
		return err
	}
	return s.storage.Delete(ctx, doc.FilePath)
}