package auth

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"os"
)

// LoadPrivateKeyFromEnvOrFile carrega uma RSA private key do conteúdo da env envKey
// (PEM direto ou base64-encoded PEM) ou, se não definida, lê o arquivo apontado por pathKey.
func LoadPrivateKeyFromEnvOrFile(envKey, pathKey string) (*rsa.PrivateKey, error) {
	if content := os.Getenv(envKey); content != "" {
		return parseRSAPrivateKey([]byte(content))
	}
	path := os.Getenv(pathKey)
	if path == "" {
		return nil, fmt.Errorf("auth: neither %s nor %s is set", envKey, pathKey)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("auth: read key file: %w", err)
	}
	return parseRSAPrivateKey(data)
}

func parseRSAPrivateKey(data []byte) (*rsa.PrivateKey, error) {
	// Aceita base64-encoded PEM (útil para armazenar em env vars sem quebras de linha)
	if decoded, err := base64.StdEncoding.DecodeString(string(data)); err == nil {
		data = decoded
	}
	block, _ := pem.Decode(data)
	if block == nil {
		return nil, fmt.Errorf("auth: failed to decode PEM block")
	}
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("auth: parse private key: %w", err)
	}
	rsaKey, ok := key.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("auth: key is not RSA")
	}
	return rsaKey, nil
}
