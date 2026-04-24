package main

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	httpSwagger "github.com/swaggo/http-swagger"

	"github.com/inquilinotop/api/internal/audit"
	"github.com/inquilinotop/api/internal/document"
	"github.com/inquilinotop/api/internal/expense"
	_ "github.com/inquilinotop/api/docs"
	"github.com/inquilinotop/api/internal/fiscal"
	"github.com/inquilinotop/api/internal/identity"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/inquilinotop/api/internal/notification"
	"github.com/inquilinotop/api/internal/payment"
	"github.com/inquilinotop/api/internal/property"
	"github.com/inquilinotop/api/internal/ratelimit"
	"github.com/inquilinotop/api/internal/support"
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
	indexRepo := lease.NewIndexRepository(database)
	leaseSvc := lease.NewService(leaseRepo, leaseReadjRepo, indexRepo)
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

	supportRepo := support.NewRepository(database)
	supportSvc := support.NewService(supportRepo)
	supportHandler := support.NewHandler(supportSvc)

	auditRepo := audit.NewRepository(database.Pool)
	auditSvc := audit.NewService(auditRepo)
	auditHandler := audit.NewHandler(auditSvc)

	docStoragePath := envOr("DOCUMENT_STORAGE_PATH", "./documents")
	docStorage := document.NewLocalStorage(docStoragePath)
	documentRepo := document.NewRepository(database)
	documentSvc := document.NewService(documentRepo, docStorage)
	documentHandler := document.NewHandler(documentSvc)

	smtpConfig := notification.SMTPConfig{
		Host:     envOr("SMTP_HOST", "localhost"),
		Port:     envOrInt("SMTP_PORT", 587),
		Username: os.Getenv("SMTP_USERNAME"),
		Password: os.Getenv("SMTP_PASSWORD"),
		From:     envOr("EMAIL_FROM", "InquilinoTop <noreply@inquilinotop.com>"),
	}
	emailSender := notification.NewSMTPSender(smtpConfig)
	notificationRepo := notification.NewRepository(database)
	notificationSvc := notification.NewService(notificationRepo, emailSender)
	notificationHandler := notification.NewHandler(notificationSvc)

	rateLimiter := ratelimit.NewMiddleware(ratelimit.Config{
		IPRate:    100 / 60.0,
		IPBurst:  100,
		UserRate: 200 / 60.0,
		UserBurst: 200,
	})

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(rateLimiter.Middleware)
	r.Use(corsMiddleware)

	// API v2 group com header
	r.Route("/api/v2", func(r2 chi.Router) {
		r2.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				w.Header().Set("API-Version", "2.0")
				next.ServeHTTP(w, req)
			})
		})
	})
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
	supportHandler.Register(r, authMW)
	auditHandler.Register(r, authMW)
	documentHandler.Register(r, authMW)
	notificationHandler.Register(r, authMW)

	port := envOr("PORT", "8080")
	slog.Info("server starting", "port", port)
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout: 60 * time.Second,
	}

	idleConnsClosed := make(chan struct{})
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
		<-sigCh

		slog.Info("shutting down server...")
		
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		if err := srv.Shutdown(ctx); err != nil {
			slog.Error("server shutdown error", "error", err)
		}
		close(idleConnsClosed)
	}()

	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		slog.Error("server error", "error", err)
		os.Exit(1)
	}

	<-idleConnsClosed
	slog.Info("server stopped gracefully")
}

func corsMiddleware(next http.Handler) http.Handler {
	allowedOrigins := strings.Split(os.Getenv("CORS_ALLOWED_ORIGINS"), ",")
	for i, o := range allowedOrigins {
		allowedOrigins[i] = strings.TrimSpace(o)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		allowed := false
		if len(allowedOrigins) == 0 {
			slog.Warn("CORS_ALLOWED_ORIGINS not set, defaulting to reject")
			allowed = false
		} else {
			for _, allowedOrigin := range allowedOrigins {
				if allowedOrigin == "*" {
					slog.Error("CORS wildcard origin not allowed for security")
					httputil.Err(w, http.StatusForbidden, "CORS_INVALID", "wildcard origin não permitido")
					return
				}
				if origin == allowedOrigin {
					allowed = true
					break
				}
			}
		}

		if allowed {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		}

		if r.Method == http.MethodOptions {
			if !allowed {
				w.WriteHeader(http.StatusForbidden)
				return
			}
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

func envOrInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		var n int
		if _, err := fmt.Sscanf(v, "%d", &n); err == nil {
			return n
		}
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