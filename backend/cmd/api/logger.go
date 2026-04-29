package main

import (
	"log/slog"
	"os"
	"strings"
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
			// Invalid level, use default (info)
			level = slog.LevelInfo
		}
	}

	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: level,
	}))
}
