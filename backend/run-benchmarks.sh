#!/bin/bash
# Benchmarks for InquilinoTop API

echo "=== JWT Benchmarks ==="
docker compose exec backend go test -bench=BenchmarkJWT -benchtime=3s -benchmem ./pkg/auth/... 2>&1 | grep -E "^(Benchmark|ok)"

echo ""
echo "=== Auth Benchmarks ==="  
docker compose exec -e GOFLAGS="-run=^$" backend go test -bench=BenchmarkBCrypt -benchtime=3s -benchmem ./internal/identity/... 2>&1 | grep -E "^(Benchmark|ok)" || true