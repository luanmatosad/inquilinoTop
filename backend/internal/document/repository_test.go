package document_test

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/document"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testDB(t *testing.T) *db.DB {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		url = "postgres://postgres:postgres@localhost:5433/inquilinotop_test?sslmode=disable"
	}
	d, err := db.New(context.Background(), url)
	require.NoError(t, err)
	require.NoError(t, db.RunMigrations(url, "../../migrations"))
	t.Cleanup(func() {
		d.Pool.Exec(context.Background(), "TRUNCATE users CASCADE")
		d.Close()
	})
	return d
}

func seedOwner(t *testing.T, database *db.DB, email string) uuid.UUID {
	t.Helper()
	var ownerID uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		email, "hash",
	).Scan(&ownerID)
	require.NoError(t, err)
	return ownerID
}

func TestDocumentRepository_Create(t *testing.T) {
	database := testDB(t)
	ownerID := seedOwner(t, database, "doc-test@test.com")
	repo := document.NewRepository(database)

	doc, err := repo.Create(context.Background(), ownerID, document.CreateDocumentInput{
		EntityType: "property",
		EntityID:   uuid.New().String(),
		Filename:   "contrato.pdf",
		MimeType:   "application/pdf",
		SizeBytes:  1024,
	}, "uploads/contrato.pdf")

	require.NoError(t, err)
	assert.Equal(t, "application/pdf", doc.MimeType)
	assert.Equal(t, ownerID, doc.OwnerID)
	assert.Equal(t, "uploads/contrato.pdf", doc.FilePath)
}

func TestDocumentRepository_GetByID_Encontrado(t *testing.T) {
	database := testDB(t)
	ownerID := seedOwner(t, database, "doc-get@test.com")
	repo := document.NewRepository(database)

	created, _ := repo.Create(context.Background(), ownerID, document.CreateDocumentInput{
		EntityType: "lease",
		EntityID:   uuid.New().String(),
		Filename:   "lease.pdf",
		MimeType:   "application/pdf",
		SizeBytes:  2048,
	}, "uploads/lease.pdf")

	found, err := repo.GetByID(context.Background(), created.ID, ownerID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, found.ID)
}

func TestDocumentRepository_GetByID_OutroOwner(t *testing.T) {
	database := testDB(t)
	ownerID := seedOwner(t, database, "doc-owner@test.com")
	repo := document.NewRepository(database)

	created, _ := repo.Create(context.Background(), ownerID, document.CreateDocumentInput{
		EntityType: "unit",
		EntityID:   uuid.New().String(),
		Filename:   "planta.pdf",
		MimeType:   "application/pdf",
		SizeBytes:  512,
	}, "uploads/planta.pdf")

	_, err := repo.GetByID(context.Background(), created.ID, uuid.New())
	assert.Error(t, err)
}

func TestDocumentRepository_ListByEntity(t *testing.T) {
	database := testDB(t)
	ownerID := seedOwner(t, database, "doc-list@test.com")
	repo := document.NewRepository(database)
	entityID := uuid.New()

	repo.Create(context.Background(), ownerID, document.CreateDocumentInput{
		EntityType: "property", EntityID: entityID.String(),
		Filename: "a.pdf", MimeType: "application/pdf", SizeBytes: 100,
	}, "uploads/a.pdf")
	repo.Create(context.Background(), ownerID, document.CreateDocumentInput{
		EntityType: "property", EntityID: entityID.String(),
		Filename: "b.pdf", MimeType: "application/pdf", SizeBytes: 200,
	}, "uploads/b.pdf")

	list, err := repo.ListByEntity(context.Background(), ownerID, "property", entityID)
	require.NoError(t, err)
	assert.Len(t, list, 2)
}

func TestDocumentRepository_Delete(t *testing.T) {
	database := testDB(t)
	ownerID := seedOwner(t, database, "doc-del@test.com")
	repo := document.NewRepository(database)
	entityID := uuid.New()

	created, _ := repo.Create(context.Background(), ownerID, document.CreateDocumentInput{
		EntityType: "tenant", EntityID: entityID.String(),
		Filename: "rg.pdf", MimeType: "application/pdf", SizeBytes: 300,
	}, "uploads/rg.pdf")

	err := repo.Delete(context.Background(), created.ID, ownerID)
	require.NoError(t, err)

	list, _ := repo.ListByEntity(context.Background(), ownerID, "tenant", entityID)
	assert.Empty(t, list)
}

func TestDocumentRepository_Delete_NãoEncontrado(t *testing.T) {
	database := testDB(t)
	seedOwner(t, database, "doc-del-nf@test.com")
	repo := document.NewRepository(database)

	err := repo.Delete(context.Background(), uuid.New(), uuid.New())
	assert.Error(t, err)
}
