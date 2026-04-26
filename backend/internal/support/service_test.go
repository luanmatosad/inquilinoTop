package support_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/support"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockRepo struct {
	tickets map[uuid.UUID]*support.Ticket
}

func newMockRepo() *mockRepo {
	return &mockRepo{tickets: make(map[uuid.UUID]*support.Ticket)}
}

func (m *mockRepo) Create(_ context.Context, userID uuid.UUID, in support.CreateTicketInput) (*support.Ticket, error) {
	t := &support.Ticket{
		ID:        uuid.New(),
		UserID:    userID,
		Tipo:      in.Tipo,
		Assunto:   in.Assunto,
		Descricao: in.Descricao,
		Status:    "open",
	}
	m.tickets[t.ID] = t
	return t, nil
}

func (m *mockRepo) GetByID(_ context.Context, id, userID uuid.UUID) (*support.Ticket, error) {
	t, ok := m.tickets[id]
	if !ok || t.UserID != userID {
		return nil, errors.New("not found")
	}
	return t, nil
}

func (m *mockRepo) ListByUser(_ context.Context, userID uuid.UUID) ([]support.Ticket, error) {
	var list []support.Ticket
	for _, t := range m.tickets {
		if t.UserID == userID {
			list = append(list, *t)
		}
	}
	return list, nil
}

func TestService_Create_Válido(t *testing.T) {
	svc := support.NewService(newMockRepo())
	userID := uuid.New()

	ticket, err := svc.Create(context.Background(), userID, support.CreateTicketInput{
		Tipo:      "BUG",
		Assunto:   "Erro ao salvar",
		Descricao: "Ao clicar em salvar, retorna 500",
	})
	require.NoError(t, err)
	assert.Equal(t, "BUG", ticket.Tipo)
	assert.Equal(t, userID, ticket.UserID)
	assert.Equal(t, "open", ticket.Status)
}

func TestService_Get_Encontrado(t *testing.T) {
	mock := newMockRepo()
	svc := support.NewService(mock)
	userID := uuid.New()

	created, _ := svc.Create(context.Background(), userID, support.CreateTicketInput{
		Tipo: "DOUBT", Assunto: "Como funciona?", Descricao: "Quero entender o fluxo",
	})
	found, err := svc.Get(context.Background(), created.ID, userID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, found.ID)
}

func TestService_Get_OutroUsuário(t *testing.T) {
	mock := newMockRepo()
	svc := support.NewService(mock)
	userID := uuid.New()

	created, _ := svc.Create(context.Background(), userID, support.CreateTicketInput{
		Tipo: "BUG", Assunto: "Erro", Descricao: "Descrição",
	})
	_, err := svc.Get(context.Background(), created.ID, uuid.New())
	assert.Error(t, err)
}

func TestService_Get_NãoEncontrado(t *testing.T) {
	svc := support.NewService(newMockRepo())
	_, err := svc.Get(context.Background(), uuid.New(), uuid.New())
	assert.Error(t, err)
}

func TestService_ListByUser_Vazio(t *testing.T) {
	svc := support.NewService(newMockRepo())
	list, err := svc.ListByUser(context.Background(), uuid.New())
	require.NoError(t, err)
	assert.Empty(t, list)
}

func TestService_ListByUser_SóDoMesmoUsuário(t *testing.T) {
	mock := newMockRepo()
	svc := support.NewService(mock)
	userA := uuid.New()
	userB := uuid.New()

	svc.Create(context.Background(), userA, support.CreateTicketInput{Tipo: "BUG", Assunto: "A1", Descricao: "d"})
	svc.Create(context.Background(), userA, support.CreateTicketInput{Tipo: "FEATURE", Assunto: "A2", Descricao: "d"})
	svc.Create(context.Background(), userB, support.CreateTicketInput{Tipo: "DOUBT", Assunto: "B1", Descricao: "d"})

	listA, err := svc.ListByUser(context.Background(), userA)
	require.NoError(t, err)
	assert.Len(t, listA, 2)

	listB, _ := svc.ListByUser(context.Background(), userB)
	assert.Len(t, listB, 1)
}
