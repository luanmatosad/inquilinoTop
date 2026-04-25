package apierr_test

import (
	"errors"
	"fmt"
	"testing"

	"github.com/inquilinotop/api/pkg/apierr"
)

func TestErrNotFound_IsSentinel(t *testing.T) {
	wrapped := fmt.Errorf("wrapped: %w", apierr.ErrNotFound)
	if !errors.Is(wrapped, apierr.ErrNotFound) {
		t.Fatal("ErrNotFound must work as sentinel with errors.Is")
	}
}
