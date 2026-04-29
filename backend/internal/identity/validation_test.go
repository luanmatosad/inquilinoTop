package identity_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestHandler_Register_InvalidEmailFormat(t *testing.T) {
	router, _ := newTestHandler(t)
	body, _ := json.Marshal(map[string]string{"email": "notanemail", "password": "senha123"})
	req := httptest.NewRequest("POST", "/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandler_Register_ShortPassword(t *testing.T) {
	router, _ := newTestHandler(t)
	body, _ := json.Marshal(map[string]string{"email": "user@test.com", "password": "abc"})
	req := httptest.NewRequest("POST", "/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}
