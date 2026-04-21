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
	httpSwagger "github.com/swaggo/http-swagger"
	"github.com/inquilinotop/api/internal/expense"
	_ "github.com/inquilinotop/api/docs"
	"github.com/inquilinotop/api/internal/fiscal"
	"github.com/inquilinotop/api/internal/identity"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/inquilinotop/api/internal/payment"
	"github.com/inquilinotop/api/internal/property"
	"github.com/inquilinotop/api/internal/tenant"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/inquilinotop/api/pkg/httputil"
)

//	@title			InquilinoTop API
//	@version		1.0
//	@description	API de gestão de imóveis para locação
//	@host			localhost:8080
//	@BasePath		/api/v1

//	@securityDefinitions.apikey	BearerAuth
//	@in							header
//	@name						Authorization
//	@description				JWT token no formato: Bearer <token>

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

	leaseRepo := lease.NewRepository(database)
	leaseReadjRepo := lease.NewReadjustmentRepository(database)
	leaseSvc := lease.NewService(leaseRepo, leaseReadjRepo)
	leaseHandler := lease.NewHandler(leaseSvc)

	identityRepoForPayment := identity.NewRepository(database)
	irrTable := fiscal.NewIRRFTable(fiscal.NewBracketsRepository(database))

	unitReader := &payment.UnitReaderAdapter{Repo: propertyRepo}
	ownerReader := &payment.OwnerReaderAdapter{Repo: identityRepoForPayment}

	paymentRepo := payment.NewRepository(database)
	paymentSvc := payment.NewService(paymentRepo, leaseRepo, tenantRepo, unitReader, ownerReader, irrTable)
	paymentHandler := payment.NewHandler(paymentSvc)

	expenseRepo := expense.NewRepository(database)
	expenseSvc := expense.NewService(expenseRepo)
	expenseHandler := expense.NewHandler(expenseSvc)

	fiscalAggRepo := fiscal.NewAggregateRepository(database)
	fiscalSvc := fiscal.NewService(fiscalAggRepo)
	fiscalHandler := fiscal.NewHandler(fiscalSvc)

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(corsMiddleware)

	r.Get("/swagger/*", httpSwagger.WrapHandler)

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
	leaseHandler.Register(r, authMW)
	paymentHandler.Register(r, authMW)
	expenseHandler.Register(r, authMW)
	fiscalHandler.Register(r, authMW)

	port := envOr("PORT", "8080")
	slog.Info("server starting", "port", port)
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	if err := srv.ListenAndServe(); err != nil {
		slog.Error("server error", "error", err)
		os.Exit(1)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
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
	if block == nil {
		slog.Error("failed to decode PEM block", "path", path)
		os.Exit(1)
	}
	key, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	if err != nil {
		slog.Error("failed to parse private key", "error", err)
		os.Exit(1)
	}
	return key
}
