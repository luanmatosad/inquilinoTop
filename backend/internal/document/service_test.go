package document_test

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/document"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- mocks ---

type mockStorage struct {
	saved   map[string]string
	deleted []string
}

func newMockStorage() *mockStorage {
	return &mockStorage{saved: make(map[string]string)}
}

func (m *mockStorage) Save(_ context.Context, ownerID uuid.UUID, filename string, r io.Reader) (string, error) {
	path := ownerID.String() + "/" + filename
	m.saved[path] = path
	return path, nil
}

func (m *mockStorage) Load(_ context.Context, path string) (io.ReadCloser, error) {
	if _, ok := m.saved[path]; !ok {
		return nil, errors.New("not found")
	}
	return io.NopCloser(strings.NewReader("conteúdo")), nil
}

func (m *mockStorage) Delete(_ context.Context, path string) error {
	delete(m.saved, path)
	m.deleted = append(m.deleted, path)
	return nil
}

type mockDocRepo struct {
	docs map[uuid.UUID]*document.Document
}

func newMockDocRepo() *mockDocRepo {
	return &mockDocRepo{docs: make(map[uuid.UUID]*document.Document)}
}

func (m *mockDocRepo) Create(_ context.Context, ownerID uuid.UUID, in document.CreateDocumentInput, filePath string) (*document.Document, error) {
	entityID, _ := uuid.Parse(in.EntityID)
	d := &document.Document{
		ID:         uuid.New(),
		OwnerID:    ownerID,
		EntityType: in.EntityType,
		EntityID:   entityID,
		Filename:   in.Filename,
		MimeType:   in.MimeType,
		SizeBytes:  in.SizeBytes,
		FilePath:   filePath,
	}
	m.docs[d.ID] = d
	return d, nil
}

func (m *mockDocRepo) GetByID(_ context.Context, id, ownerID uuid.UUID) (*document.Document, error) {
	d, ok := m.docs[id]
	if !ok || d.OwnerID != ownerID {
		return nil, apierr.ErrNotFound
	}
	return d, nil
}

func (m *mockDocRepo) ListByEntity(_ context.Context, ownerID uuid.UUID, entityType string, entityID uuid.UUID) ([]document.Document, error) {
	var list []document.Document
	for _, d := range m.docs {
		if d.OwnerID == ownerID && d.EntityType == entityType && d.EntityID == entityID {
			list = append(list, *d)
		}
	}
	return list, nil
}

func (m *mockDocRepo) Delete(_ context.Context, id, ownerID uuid.UUID) error {
	d, ok := m.docs[id]
	if !ok || d.OwnerID != ownerID {
		return apierr.ErrNotFound
	}
	delete(m.docs, id)
	return nil
}

// --- testes ---

func TestService_Upload_Válido(t *testing.T) {
	repo := newMockDocRepo()
	storage := newMockStorage()
	svc := document.NewService(repo, storage)
	ownerID := uuid.New()

	doc, err := svc.Upload(context.Background(), ownerID, document.CreateDocumentInput{
		EntityType: "property",
		EntityID:   uuid.New().String(),
		Filename:   "contrato.pdf",
		MimeType:   "application/pdf",
		SizeBytes:  1024,
	}, strings.NewReader("conteúdo do arquivo"))

	require.NoError(t, err)
	assert.Equal(t, "application/pdf", doc.MimeType)
	assert.Equal(t, ownerID, doc.OwnerID)
}

func TestService_Upload_MimeTypeInválido(t *testing.T) {
	svc := document.NewService(newMockDocRepo(), newMockStorage())

	_, err := svc.Upload(context.Background(), uuid.New(), document.CreateDocumentInput{
		EntityType: "property",
		EntityID:   uuid.New().String(),
		Filename:   "imagem.png",
		MimeType:   "image/png",
		SizeBytes:  1024,
	}, strings.NewReader("conteúdo"))

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "não permitido")
}

func TestService_Upload_FalhaNaRepo_RemoveArquivo(t *testing.T) {
	storage := newMockStorage()
	repo := &failingRepo{}
	svc := document.NewService(repo, storage)
	ownerID := uuid.New()

	_, err := svc.Upload(context.Background(), ownerID, document.CreateDocumentInput{
		EntityType: "lease",
		EntityID:   uuid.New().String(),
		Filename:   "doc.pdf",
		MimeType:   "application/pdf",
		SizeBytes:  512,
	}, strings.NewReader("dados"))

	assert.Error(t, err)
	assert.Len(t, storage.deleted, 1, "deve remover arquivo do storage quando repo falha")
}

func TestService_GetDocument_Encontrado(t *testing.T) {
	repo := newMockDocRepo()
	svc := document.NewService(repo, newMockStorage())
	ownerID := uuid.New()

	created, _ := svc.Upload(context.Background(), ownerID, document.CreateDocumentInput{
		EntityType: "unit",
		EntityID:   uuid.New().String(),
		Filename:   "planta.pdf",
		MimeType:   "application/pdf",
		SizeBytes:  2048,
	}, strings.NewReader("x"))

	found, err := svc.GetDocument(context.Background(), created.ID, ownerID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, found.ID)
}

func TestService_GetDocument_OutroOwner(t *testing.T) {
	repo := newMockDocRepo()
	svc := document.NewService(repo, newMockStorage())
	ownerID := uuid.New()

	created, _ := svc.Upload(context.Background(), ownerID, document.CreateDocumentInput{
		EntityType: "unit",
		EntityID:   uuid.New().String(),
		Filename:   "doc.pdf",
		MimeType:   "application/pdf",
		SizeBytes:  100,
	}, strings.NewReader("x"))

	_, err := svc.GetDocument(context.Background(), created.ID, uuid.New())
	assert.Error(t, err)
}

func TestService_ListByEntity(t *testing.T) {
	repo := newMockDocRepo()
	svc := document.NewService(repo, newMockStorage())
	ownerID := uuid.New()
	entityID := uuid.New()

	svc.Upload(context.Background(), ownerID, document.CreateDocumentInput{
		EntityType: "property", EntityID: entityID.String(),
		Filename: "a.pdf", MimeType: "application/pdf", SizeBytes: 100,
	}, strings.NewReader("a"))
	svc.Upload(context.Background(), ownerID, document.CreateDocumentInput{
		EntityType: "property", EntityID: entityID.String(),
		Filename: "b.pdf", MimeType: "application/pdf", SizeBytes: 200,
	}, strings.NewReader("b"))

	list, err := svc.ListByEntity(context.Background(), ownerID, "property", entityID)
	require.NoError(t, err)
	assert.Len(t, list, 2)
}

func TestService_Delete_RemoveRepoEStorage(t *testing.T) {
	repo := newMockDocRepo()
	storage := newMockStorage()
	svc := document.NewService(repo, storage)
	ownerID := uuid.New()

	created, _ := svc.Upload(context.Background(), ownerID, document.CreateDocumentInput{
		EntityType: "tenant", EntityID: uuid.New().String(),
		Filename: "rg.pdf", MimeType: "application/pdf", SizeBytes: 300,
	}, strings.NewReader("rg"))

	err := svc.Delete(context.Background(), created.ID, ownerID)
	require.NoError(t, err)
	assert.Len(t, storage.deleted, 1)
	assert.Empty(t, repo.docs)
}

func TestService_Delete_NãoEncontrado(t *testing.T) {
	svc := document.NewService(newMockDocRepo(), newMockStorage())
	err := svc.Delete(context.Background(), uuid.New(), uuid.New())
	assert.Error(t, err)
}

// failingRepo simula falha no Create
type failingRepo struct{ mockDocRepo }

func (f *failingRepo) Create(_ context.Context, _ uuid.UUID, _ document.CreateDocumentInput, _ string) (*document.Document, error) {
	return nil, errors.New("db error")
}
func (f *failingRepo) GetByID(ctx context.Context, id, ownerID uuid.UUID) (*document.Document, error) {
	return f.mockDocRepo.GetByID(ctx, id, ownerID)
}
func (f *failingRepo) ListByEntity(ctx context.Context, ownerID uuid.UUID, entityType string, entityID uuid.UUID) ([]document.Document, error) {
	return f.mockDocRepo.ListByEntity(ctx, ownerID, entityType, entityID)
}
func (f *failingRepo) Delete(ctx context.Context, id, ownerID uuid.UUID) error {
	return f.mockDocRepo.Delete(ctx, id, ownerID)
}
