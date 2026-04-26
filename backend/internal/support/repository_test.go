package support_test

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/support"
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

func seedUser(t *testing.T, database *db.DB) uuid.UUID {
	t.Helper()
	var userID uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		"support-test@test.com", "hash",
	).Scan(&userID)
	require.NoError(t, err)
	return userID
}

func TestSupportRepository_Create(t *testing.T) {
	database := testDB(t)
	userID := seedUser(t, database)
	repo := support.NewRepository(database)

	ticket, err := repo.Create(context.Background(), userID, support.CreateTicketInput{
		Tipo:      "BUG",
		Assunto:   "Erro ao carregar página",
		Descricao: "A página de imóveis não carrega após o login",
	})
	require.NoError(t, err)
	assert.Equal(t, "BUG", ticket.Tipo)
	assert.Equal(t, "open", ticket.Status)
	assert.Equal(t, userID, ticket.UserID)
}

func TestSupportRepository_GetByID_Encontrado(t *testing.T) {
	database := testDB(t)
	userID := seedUser(t, database)
	repo := support.NewRepository(database)

	created, _ := repo.Create(context.Background(), userID, support.CreateTicketInput{
		Tipo: "DOUBT", Assunto: "Como funciona?", Descricao: "Quero entender o fluxo de pagamentos",
	})
	found, err := repo.GetByID(context.Background(), created.ID, userID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, found.ID)
}

func TestSupportRepository_GetByID_OutroUsuário(t *testing.T) {
	database := testDB(t)
	userID := seedUser(t, database)
	repo := support.NewRepository(database)

	created, _ := repo.Create(context.Background(), userID, support.CreateTicketInput{
		Tipo: "BUG", Assunto: "Erro", Descricao: "Descrição",
	})
	_, err := repo.GetByID(context.Background(), created.ID, uuid.New())
	assert.Error(t, err)
}

func TestSupportRepository_ListByUser(t *testing.T) {
	database := testDB(t)
	userID := seedUser(t, database)
	repo := support.NewRepository(database)

	repo.Create(context.Background(), userID, support.CreateTicketInput{
		Tipo: "BUG", Assunto: "Bug 1", Descricao: "Descrição 1",
	})
	repo.Create(context.Background(), userID, support.CreateTicketInput{
		Tipo: "FEATURE", Assunto: "Feature 1", Descricao: "Descrição 2",
	})

	list, err := repo.ListByUser(context.Background(), userID)
	require.NoError(t, err)
	assert.Len(t, list, 2)
}

func TestSupportRepository_ListByUser_OutroUsuárioNãoVê(t *testing.T) {
	database := testDB(t)
	userID := seedUser(t, database)
	repo := support.NewRepository(database)

	repo.Create(context.Background(), userID, support.CreateTicketInput{
		Tipo: "BUG", Assunto: "Privado", Descricao: "Não deve aparecer para outros",
	})

	list, err := repo.ListByUser(context.Background(), uuid.New())
	require.NoError(t, err)
	assert.Empty(t, list)
}
