package validator

import (
	"sync"

	"github.com/go-playground/validator/v10"
)

var (
	v   *validator.Validate
	once sync.Once
)

func Get() *validator.Validate {
	once.Do(func() {
		v = validator.New()
	})
	return v
}

func Validate(s interface{}) error {
	return Get().Struct(s)
}