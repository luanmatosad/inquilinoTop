package main

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/inquilinotop/api/internal/identity"
	"github.com/inquilinotop/api/internal/property"
	"github.com/inquilinotop/api/internal/tenant"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/inquilinotop/api/pkg/httputil"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	databaseURL := mustEnv("DATABASE_URL")
	database, err := db.New(context.Background(), databaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer database.Close()

	migrationsPath := envOr("MIGRATIONS_PATH", "./migrations")
	if err := db.RunMigrations(databaseURL, migrationsPath); err != nil {
		slog.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}

	privKey := mustLoadPrivateKey(mustEnv("JWT_PRIVATE_KEY_PATH"))
	jwtSvc := auth.NewJWTService(privKey, &privKey.PublicKey, 15*time.Minute)
	authMW := auth.Middleware(jwtSvc)

	identityRepo := identity.NewRepository(database)
	identitySvc := identity.NewService(identityRepo, jwtSvc)
	identityHandler := identity.NewHandler(identitySvc)

	propertyRepo := property.NewRepository(database)
	propertySvc := property.NewService(propertyRepo)
	propertyHandler := property.NewHandler(propertySvc)

	tenantRepo := tenant.NewRepository(database)
	tenantSvc := tenant.NewService(tenantRepo)
	tenantHandler := tenant.NewHandler(tenantSvc)

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		if err := database.Pool.Ping(r.Context()); err != nil {
			httputil.Err(w, http.StatusServiceUnavailable, "DB_UNAVAILABLE", "banco indisponível")
			return
		}
		httputil.OK(w, map[string]string{"status": "ok"})
	})

	identityHandler.Register(r)
	propertyHandler.Register(r, authMW)
	tenantHandler.Register(r, authMW)

	port := envOr("PORT", "8080")
	slog.Info("server starting", "port", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		slog.Error("server error", "error", err)
		os.Exit(1)
	}
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		slog.Error("missing required env var", "key", key)
		os.Exit(1)
	}
	return v
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func mustLoadPrivateKey(path string) *rsa.PrivateKey {
	data, err := os.ReadFile(path)
	if err != nil {
		slog.Error("failed to read private key", "path", path, "error", err)
		os.Exit(1)
	}
	block, _ := pem.Decode(data)
	key, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	if err != nil {
		slog.Error("failed to parse private key", "error", err)
		os.Exit(1)
	}
	return key
}
