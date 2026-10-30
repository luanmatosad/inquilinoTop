package apierr

import "errors"

var (
	ErrNotFound = errors.New("not found")
	// ErrConflict indica violação de unicidade ou estado incompatível (HTTP 409).
	ErrConflict = errors.New("conflict")
)
