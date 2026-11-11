package organization_test

import (
	"bytes"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/organization"
	"github.com/inquilinotop/api/internal/rbac"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const tokenAceite = "token-de-teste-do-aceite"

func postAcceptInvite(srv http.Handler, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/invites/accept", bytes.NewBufferString(`{"token":"`+token+`"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	return rec
}

func TestHandler_AcceptInvite_Sucesso(t *testing.T) {
	repo := newMockRepo()
	userID := uuid.New()
	repo.emails[userID] = "guest@x.com"
	seedInvite(repo, uuid.New(), "guest@x.com", tokenAceite, time.Now().Add(time.Hour))

	rec := postAcceptInvite(buildRoutes(repo, rbac.RoleEmployee, userID, uuid.Nil), tokenAceite)

	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestHandler_AcceptInvite_CodigosDeErro(t *testing.T) {
	futuro := time.Now().Add(time.Hour)
	casos := []struct {
		nome    string
		prepara func(repo *mockRepo, userID uuid.UUID) string
		status  int
		codigo  string
	}{
		{
			nome:    "token desconhecido",
			prepara: func(*mockRepo, uuid.UUID) string { return "inexistente" },
			status:  http.StatusNotFound,
			codigo:  "INVITE_NOT_FOUND",
		},
		{
			nome: "convite de outro e-mail não revela existência",
			prepara: func(repo *mockRepo, userID uuid.UUID) string {
				repo.emails[userID] = "outro@x.com"
				seedInvite(repo, uuid.New(), "guest@x.com", tokenAceite, futuro)
				return tokenAceite
			},
			status: http.StatusNotFound,
			codigo: "INVITE_NOT_FOUND",
		},
		{
			nome: "convite expirado",
			prepara: func(repo *mockRepo, userID uuid.UUID) string {
				seedInvite(repo, uuid.New(), "guest@x.com", tokenAceite, time.Now().Add(-time.Hour))
				return tokenAceite
			},
			status: http.StatusBadRequest,
			codigo: "INVITE_EXPIRED",
		},
		{
			nome: "convite já usado",
			prepara: func(repo *mockRepo, userID uuid.UUID) string {
				inv := seedInvite(repo, uuid.New(), "guest@x.com", tokenAceite, futuro)
				usado := time.Now()
				inv.AcceptedAt = &usado
				return tokenAceite
			},
			status: http.StatusConflict,
			codigo: "INVITE_ALREADY_USED",
		},
		{
			nome: "filial do convite removida",
			prepara: func(repo *mockRepo, userID uuid.UUID) string {
				inv := seedInvite(repo, uuid.New(), "guest@x.com", tokenAceite, futuro)
				filialRemovida := uuid.New()
				inv.BranchID = &filialRemovida
				return tokenAceite
			},
			status: http.StatusConflict,
			codigo: "INVITE_BRANCH_GONE",
		},
		{
			nome: "usuário já pertence a outra organização",
			prepara: func(repo *mockRepo, userID uuid.UUID) string {
				repo.members[uuid.New()] = &organization.Member{UserID: userID}
				seedInvite(repo, uuid.New(), "guest@x.com", tokenAceite, futuro)
				return tokenAceite
			},
			status: http.StatusConflict,
			codigo: "ALREADY_HAS_ORG",
		},
		{
			nome: "falha de banco não vaza detalhe",
			prepara: func(repo *mockRepo, userID uuid.UUID) string {
				repo.acceptErr = errors.New("pq: senha vazada na conexão")
				seedInvite(repo, uuid.New(), "guest@x.com", tokenAceite, futuro)
				return tokenAceite
			},
			status: http.StatusInternalServerError,
			codigo: "ACCEPT_INVITE_FAILED",
		},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			repo := newMockRepo()
			userID := uuid.New()
			repo.emails[userID] = "guest@x.com"
			token := c.prepara(repo, userID)

			rec := postAcceptInvite(buildRoutes(repo, rbac.RoleEmployee, userID, uuid.Nil), token)

			require.Equal(t, c.status, rec.Code, rec.Body.String())
			assert.Contains(t, rec.Body.String(), c.codigo)
			assert.NotContains(t, rec.Body.String(), "senha vazada")
		})
	}
}

func TestHandler_ListInvites_NaoExpoeToken(t *testing.T) {
	repo := newMockRepo()
	orgID := uuid.New()
	seedInvite(repo, orgID, "novo@x.com", "segredo-do-convite", time.Now().Add(time.Hour))
	srv := buildRoutes(repo, rbac.RoleAdmin, uuid.New(), orgID)

	req := httptest.NewRequest(http.MethodGet, "/organizations/me/invites", nil)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "novo@x.com")
	assert.NotContains(t, rec.Body.String(), "segredo-do-convite")
	assert.NotContains(t, rec.Body.String(), `"token"`)
}
