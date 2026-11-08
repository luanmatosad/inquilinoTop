package payment

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// RotateLink revoga o link ativo da cobrança e grava o novo, numa transação. Só guarda o hash do token.
func (r *pgRepository) RotateLink(ctx context.Context, orgID, paymentID uuid.UUID, createdBy *uuid.UUID, tokenHash string, expiresAt time.Time) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("payment.repo: rotate link: begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var one int
	if err := tx.QueryRow(ctx,
		`SELECT 1 FROM payments WHERE id=$1 AND organization_id=$2 AND is_active=true FOR UPDATE`, paymentID, orgID,
	).Scan(&one); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("payment.repo: rotate link: payment: %w", err)
	}
	if _, err := tx.Exec(ctx,
		`UPDATE payment_links SET revoked_at=NOW() WHERE payment_id=$1 AND revoked_at IS NULL`, paymentID,
	); err != nil {
		return fmt.Errorf("payment.repo: rotate link: revoke: %w", err)
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO payment_links (organization_id, payment_id, created_by, token_hash, expires_at) VALUES ($1,$2,$3,$4,$5)`,
		orgID, paymentID, createdBy, tokenHash, expiresAt,
	); err != nil {
		return fmt.Errorf("payment.repo: rotate link: insert: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("payment.repo: rotate link: commit: %w", err)
	}
	return nil
}

// GetLinkByHash busca o link pelo hash do token. Não filtra validade: quem decide é o service.
func (r *pgRepository) GetLinkByHash(ctx context.Context, tokenHash string) (*PaymentLink, error) {
	var l PaymentLink
	err := r.db.Pool.QueryRow(ctx,
		`SELECT id, organization_id, payment_id, created_by, expires_at, revoked_at FROM payment_links WHERE token_hash=$1`, tokenHash,
	).Scan(&l.ID, &l.OrganizationID, &l.PaymentID, &l.CreatedBy, &l.ExpiresAt, &l.RevokedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("payment.repo: get link: %w", err)
	}
	return &l, nil
}

// SaveReport grava o aviso do inquilino e o evento REPORTED. Devolve o comprovante anterior, se havia.
func (r *pgRepository) SaveReport(ctx context.Context, orgID, paymentID uuid.UUID, in ReportApply) (*string, error) {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: save report: begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var old *string
	if err := tx.QueryRow(ctx,
		`SELECT proof_path FROM payments WHERE id=$1 AND organization_id=$2 AND is_active=true AND status<>'PAID' FOR UPDATE`,
		paymentID, orgID,
	).Scan(&old); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("payment.repo: save report: lock: %w", err)
	}
	if _, err := tx.Exec(ctx,
		`UPDATE payments SET reported_at=NOW(), reported_amount=$3, reported_date=$4, proof_path=$5, updated_at=NOW()
		 WHERE id=$1 AND organization_id=$2`,
		paymentID, orgID, in.Amount, in.PaidDate, in.ProofPath,
	); err != nil {
		return nil, fmt.Errorf("payment.repo: save report: %w", err)
	}
	raw, _ := json.Marshal(map[string]any{
		"amount": in.Amount, "paid_date": in.PaidDate.Format("2006-01-02"), "has_proof": in.ProofPath != nil,
	})
	if _, err := tx.Exec(ctx,
		`INSERT INTO payment_events (organization_id, payment_id, kind, data) VALUES ($1,$2,'REPORTED',$3::jsonb)`,
		orgID, paymentID, string(raw),
	); err != nil {
		return nil, fmt.Errorf("payment.repo: save report: event: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("payment.repo: save report: commit: %w", err)
	}
	return old, nil
}

// ClearReport limpa o aviso e grava o evento REJECTED. Devolve o comprovante que havia.
func (r *pgRepository) ClearReport(ctx context.Context, orgID, paymentID uuid.UUID, actorID *uuid.UUID) (*string, error) {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: clear report: begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var old *string
	if err := tx.QueryRow(ctx,
		`SELECT proof_path FROM payments
		 WHERE id=$1 AND organization_id=$2 AND is_active=true AND status<>'PAID' AND reported_at IS NOT NULL FOR UPDATE`,
		paymentID, orgID,
	).Scan(&old); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("payment.repo: clear report: lock: %w", err)
	}
	if _, err := tx.Exec(ctx,
		`UPDATE payments SET reported_at=NULL, reported_amount=NULL, reported_date=NULL, proof_path=NULL, updated_at=NOW()
		 WHERE id=$1 AND organization_id=$2`, paymentID, orgID,
	); err != nil {
		return nil, fmt.Errorf("payment.repo: clear report: %w", err)
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO payment_events (organization_id, payment_id, kind, actor_id) VALUES ($1,$2,'REJECTED',$3)`,
		orgID, paymentID, actorID,
	); err != nil {
		return nil, fmt.Errorf("payment.repo: clear report: event: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("payment.repo: clear report: commit: %w", err)
	}
	return old, nil
}
