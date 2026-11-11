package notification

import (
	"context"
	"fmt"
	"mime"
	"net/smtp"
)

type SMTPConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	From     string
}

type smtpSender struct {
	config SMTPConfig
}

func NewSMTPSender(config SMTPConfig) EmailSender {
	return &smtpSender{config: config}
}

func (s *smtpSender) Send(ctx context.Context, to, subject, body string) error {
	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		s.config.From, to, mime.QEncoding.Encode("utf-8", subject), body)

	addr := fmt.Sprintf("%s:%d", s.config.Host, s.config.Port)

	var auth smtp.Auth
	if s.config.Username != "" {
		auth = smtp.PlainAuth("", s.config.Username, s.config.Password, s.config.Host)
	}

	err := smtp.SendMail(addr, auth, s.config.From, []string{to}, []byte(msg))
	if err != nil {
		return fmt.Errorf("notification.smtp: send: %w", err)
	}
	return nil
}