package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"github.com/getsentry/sentry-go"
)

func createLogger() *slog.Logger {
	level := slog.LevelInfo
	if levelStr := os.Getenv("LOG_LEVEL"); levelStr != "" {
		levelStr = strings.ToLower(levelStr)
		switch levelStr {
		case "debug":
			level = slog.LevelDebug
		case "info":
			level = slog.LevelInfo
		case "warn":
			level = slog.LevelWarn
		case "error":
			level = slog.LevelError
		default:
			level = slog.LevelInfo
		}
	}

	inner := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})
	return slog.New(&sentrySlogHandler{inner: inner})
}

// sentrySlogHandler bridges slog → Sentry logs for Warn/Error level events.
// All records still flow through the inner handler (stdout JSON).
type sentrySlogHandler struct {
	inner slog.Handler
}

func (h *sentrySlogHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.inner.Enabled(ctx, level)
}

func (h *sentrySlogHandler) Handle(ctx context.Context, record slog.Record) error {
	if err := h.inner.Handle(ctx, record); err != nil {
		return err
	}
	if record.Level < slog.LevelWarn {
		return nil
	}

	sl := sentry.NewLogger(ctx)
	var entry sentry.LogEntry
	if record.Level == slog.LevelWarn {
		entry = sl.Warn()
	} else {
		entry = sl.Error()
	}

	record.Attrs(func(a slog.Attr) bool {
		entry = entry.String(a.Key, fmt.Sprint(a.Value.Any()))
		return true
	})
	entry.Emit(record.Message)
	return nil
}

func (h *sentrySlogHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &sentrySlogHandler{inner: h.inner.WithAttrs(attrs)}
}

func (h *sentrySlogHandler) WithGroup(name string) slog.Handler {
	return &sentrySlogHandler{inner: h.inner.WithGroup(name)}
}
