package httputil

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-playground/validator/v10"
)

type envelope struct {
	Data  any        `json:"data"`
	Error *apiError  `json:"error"`
}

type apiError struct {
	Code    string           `json:"code"`
	Message string         `json:"message"`
	Fields  []validationError `json:"fields,omitempty"`
}

type validationError struct {
	Field string `json:"field"`
	Tag   string `json:"tag"`
	Error string `json:"error"`
}

func OK(w http.ResponseWriter, data any) {
	write(w, http.StatusOK, envelope{Data: data})
}

func Created(w http.ResponseWriter, data any) {
	write(w, http.StatusCreated, envelope{Data: data})
}

func Err(w http.ResponseWriter, status int, code, message string) {
	write(w, status, envelope{Error: &apiError{Code: code, Message: message}})
}

func ValidationErr(w http.ResponseWriter, err error) {
	var verrs validator.ValidationErrors
	if !errors.As(err, &verrs) {
		Err(w, http.StatusInternalServerError, "INTERNAL_ERROR", "erro de validação")
		return
	}

	var fields []validationError
	for _, e := range verrs {
		fields = append(fields, validationError{
			Field: e.Field(),
			Tag:   e.Tag(),
			Error: e.Translate(nil),
		})
	}
	write(w, http.StatusBadRequest, envelope{
		Error: &apiError{
			Code:    "VALIDATION_ERROR",
			Message: "erro de validação",
			Fields:  fields,
		},
	})
}

func write(w http.ResponseWriter, status int, body envelope) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}
