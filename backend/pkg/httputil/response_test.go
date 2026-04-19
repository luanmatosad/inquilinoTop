package httputil_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/inquilinotop/api/pkg/httputil"
	"github.com/stretchr/testify/assert"
)

func TestOK(t *testing.T) {
	w := httptest.NewRecorder()
	httputil.OK(w, map[string]string{"id": "123"})

	assert.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	assert.NotNil(t, resp["data"])
	assert.Nil(t, resp["error"])
}

func TestErr(t *testing.T) {
	w := httptest.NewRecorder()
	httputil.Err(w, http.StatusBadRequest, "INVALID_INPUT", "campo inválido")

	assert.Equal(t, http.StatusBadRequest, w.Code)
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	assert.Nil(t, resp["data"])
	assert.NotNil(t, resp["error"])
	errObj := resp["error"].(map[string]interface{})
	assert.Equal(t, "INVALID_INPUT", errObj["code"])
}
