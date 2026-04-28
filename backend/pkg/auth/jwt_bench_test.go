package auth_test

import (
	"crypto/rand"
	"crypto/rsa"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
)

func loadKeysBench(b *testing.B) (*rsa.PrivateKey, *rsa.PublicKey) {
	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		b.Fatal(err)
	}
	return privKey, &privKey.PublicKey
}

func BenchmarkJWT_Sign(b *testing.B) {
	privKey, pubKey := loadKeysBench(b)
	svc := auth.NewJWTService(privKey, pubKey, 15*time.Minute)
	ownerID := uuid.New()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := svc.Sign(ownerID)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkJWT_Verify(b *testing.B) {
	privKey, pubKey := loadKeysBench(b)
	svc := auth.NewJWTService(privKey, pubKey, 15*time.Minute)

	ownerID := uuid.New()
	token, _ := svc.Sign(ownerID)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := svc.Verify(token)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkJWT_Middleware(b *testing.B) {
	privKey, pubKey := loadKeysBench(b)
	jwtSvc := auth.NewJWTService(privKey, pubKey, 15*time.Minute)

	ownerID := uuid.New()
	token, _ := jwtSvc.Sign(ownerID)

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})
	mw := auth.Middleware(jwtSvc)

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		mw(next).ServeHTTP(w, req)
	}
}

func BenchmarkJWT_SignAndVerify(b *testing.B) {
	privKey, pubKey := loadKeysBench(b)
	svc := auth.NewJWTService(privKey, pubKey, 15*time.Minute)
	ownerID := uuid.New()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		token, err := svc.Sign(ownerID)
		if err != nil {
			b.Fatal(err)
		}
		_, err = svc.Verify(token)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func loadKeysForBench() (*rsa.PrivateKey, *rsa.PublicKey) {
	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		panic(err)
	}
	return privKey, &privKey.PublicKey
}

func BenchmarkJWT_ParallelSign(b *testing.B) {
	privKey, pubKey := loadKeysForBench()
	svc := auth.NewJWTService(privKey, pubKey, 15*time.Minute)
	ownerID := uuid.New()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_, err := svc.Sign(ownerID)
			if err != nil {
				b.Fatal(err)
			}
		}
	})
}

func BenchmarkJWT_ParallelVerify(b *testing.B) {
	privKey, pubKey := loadKeysForBench()
	svc := auth.NewJWTService(privKey, pubKey, 15*time.Minute)

	ownerID := uuid.New()
	token, _ := svc.Sign(ownerID)

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_, err := svc.Verify(token)
			if err != nil {
				b.Fatal(err)
			}
		}
	})
}

func BenchmarkJWT_KeyGen2048(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkJWT_KeyGen4096(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := rsa.GenerateKey(rand.Reader, 4096)
		if err != nil {
			b.Fatal(err)
		}
	}
}

var sink interface{}

func BenchmarkJWT_MiddlewareChain(b *testing.B) {
	privKey, pubKey := loadKeysForBench()
	jwtSvc := auth.NewJWTService(privKey, pubKey, 15*time.Minute)

	ownerID := uuid.New()
	token, _ := jwtSvc.Sign(ownerID)

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sink = auth.OwnerIDFromCtx(r.Context())
	})
	mw := auth.Middleware(jwtSvc)

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		mw(handler).ServeHTTP(w, req)
	}
}