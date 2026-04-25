package provider

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestBradescoProvider_EnsureToken_ConcurrentCallsNoPanic(t *testing.T) {
	callCount := 0
	var mu sync.Mutex
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		callCount++
		mu.Unlock()
		time.Sleep(5 * time.Millisecond)
		resp := map[string]interface{}{
			"access_token": "tok-123",
			"expires_in":   3600,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	p := &BradescoProvider{
		clientID:     "id",
		clientSecret: "secret",
		baseURL:      srv.URL,
		client:       &http.Client{Timeout: 5 * time.Second},
	}

	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = p.ensureToken(context.Background())
		}()
	}
	wg.Wait()

	require.NotEmpty(t, p.token, "token deve estar preenchido após chamadas concorrentes")
}
