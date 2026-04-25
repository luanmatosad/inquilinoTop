package ratelimit

import (
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
)

func TestGetUserID_ReturnsOwnerIDFromContext(t *testing.T) {
	ownerID := uuid.New()
	req := httptest.NewRequest("GET", "/", nil)
	req = req.WithContext(auth.WithOwnerID(req.Context(), ownerID))

	got := getUserID(req)

	assert.Equal(t, ownerID.String(), got, "getUserID deve retornar o owner_id do contexto tipado")
}

func TestGetUserID_ReturnsEmptyWhenNoContext(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	got := getUserID(req)
	assert.Equal(t, "", got, "getUserID deve retornar vazio quando não há owner_id")
}
