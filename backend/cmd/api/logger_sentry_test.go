package main

import (
	"bytes"
	"context"
	"log/slog"
	"strings"
	"testing"
)

func TestSentrySlogHandler_DelegatesToInner(t *testing.T) {
	var buf bytes.Buffer
	inner := slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})
	h := &sentrySlogHandler{inner: inner}
	logger := slog.New(h)

	logger.Info("hello from info")

	if !strings.Contains(buf.String(), "hello from info") {
		t.Errorf("expected inner handler to receive log: %s", buf.String())
	}
}

func TestSentrySlogHandler_EnabledMatchesInner(t *testing.T) {
	var buf bytes.Buffer
	inner := slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelWarn})
	h := &sentrySlogHandler{inner: inner}

	if h.Enabled(context.Background(), slog.LevelInfo) {
		t.Error("expected Info to be disabled when inner threshold is Warn")
	}
	if !h.Enabled(context.Background(), slog.LevelWarn) {
		t.Error("expected Warn to be enabled")
	}
	if !h.Enabled(context.Background(), slog.LevelError) {
		t.Error("expected Error to be enabled")
	}
}

func TestSentrySlogHandler_WithAttrsReturnsWrapped(t *testing.T) {
	var buf bytes.Buffer
	inner := slog.NewJSONHandler(&buf, nil)
	h := &sentrySlogHandler{inner: inner}

	h2 := h.WithAttrs([]slog.Attr{slog.String("service", "api")})
	if _, ok := h2.(*sentrySlogHandler); !ok {
		t.Error("WithAttrs should return *sentrySlogHandler")
	}
}

func TestSentrySlogHandler_WithGroupReturnsWrapped(t *testing.T) {
	var buf bytes.Buffer
	inner := slog.NewJSONHandler(&buf, nil)
	h := &sentrySlogHandler{inner: inner}

	h2 := h.WithGroup("request")
	if _, ok := h2.(*sentrySlogHandler); !ok {
		t.Error("WithGroup should return *sentrySlogHandler")
	}
}

func TestSentrySlogHandler_WarnReachesInner(t *testing.T) {
	var buf bytes.Buffer
	inner := slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})
	h := &sentrySlogHandler{inner: inner}
	logger := slog.New(h)

	logger.Warn("cors rejected", "origin", "bad.example.com")

	logged := buf.String()
	if !strings.Contains(logged, "cors rejected") {
		t.Errorf("expected warn to reach inner handler: %s", logged)
	}
	if !strings.Contains(logged, "bad.example.com") {
		t.Errorf("expected attr to be in log: %s", logged)
	}
}

func TestSentrySlogHandler_ErrorReachesInner(t *testing.T) {
	var buf bytes.Buffer
	inner := slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})
	h := &sentrySlogHandler{inner: inner}
	logger := slog.New(h)

	logger.Error("db query failed", "table", "leases")

	logged := buf.String()
	if !strings.Contains(logged, "db query failed") {
		t.Errorf("expected error to reach inner handler: %s", logged)
	}
}
