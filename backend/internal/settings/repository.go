package settings

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/jackc/pgx/v5"
)

type pgRepository struct{ db *db.DB }

func NewRepository(d *db.DB) Repository { return &pgRepository{db: d} }

func (r *pgRepository) GetFinancialRules(ctx context.Context, orgID uuid.UUID) (*FinancialRules, error) {
	var f FinancialRules
	err := r.db.Pool.QueryRow(ctx,
		`SELECT late_fee_percent::float8, monthly_interest_percent::float8, default_adjustment_index, readjust_notice_days
		   FROM organization_settings WHERE organization_id=$1`, orgID,
	).Scan(&f.LateFeePercent, &f.MonthlyInterestPercent, &f.DefaultAdjustmentIndex, &f.ReadjustNoticeDays)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("settings.repo: get financial rules: %w", err)
	}
	return &f, nil
}

func (r *pgRepository) SaveFinancialRules(ctx context.Context, orgID, userID uuid.UUID, in FinancialRules) (*FinancialRules, error) {
	var f FinancialRules
	err := r.db.Pool.QueryRow(ctx,
		`INSERT INTO organization_settings (organization_id, late_fee_percent, monthly_interest_percent, default_adjustment_index, readjust_notice_days, updated_by)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 ON CONFLICT (organization_id) DO UPDATE SET
		   late_fee_percent=EXCLUDED.late_fee_percent, monthly_interest_percent=EXCLUDED.monthly_interest_percent,
		   default_adjustment_index=EXCLUDED.default_adjustment_index, readjust_notice_days=EXCLUDED.readjust_notice_days,
		   updated_by=EXCLUDED.updated_by, updated_at=NOW()
		 RETURNING late_fee_percent::float8, monthly_interest_percent::float8, default_adjustment_index, readjust_notice_days`,
		orgID, in.LateFeePercent, in.MonthlyInterestPercent, in.DefaultAdjustmentIndex, in.ReadjustNoticeDays, userID,
	).Scan(&f.LateFeePercent, &f.MonthlyInterestPercent, &f.DefaultAdjustmentIndex, &f.ReadjustNoticeDays)
	if err != nil {
		return nil, fmt.Errorf("settings.repo: save financial rules: %w", err)
	}
	return &f, nil
}

func (r *pgRepository) GetPixDefault(ctx context.Context, orgID uuid.UUID) (*PixDefault, error) {
	var d PixDefault
	var key, keyType, name, city *string
	err := r.db.Pool.QueryRow(ctx,
		`SELECT pix_key, pix_key_type, pix_receiver_name, pix_city FROM organization_settings WHERE organization_id=$1`, orgID,
	).Scan(&key, &keyType, &name, &city)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("settings.repo: get pix default: %w", err)
	}
	if key == nil || keyType == nil {
		return nil, nil
	}
	d.Configured, d.Key, d.KeyType = true, *key, *keyType
	if name != nil {
		d.ReceiverName = *name
	}
	if city != nil {
		d.City = *city
	}
	return &d, nil
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// SavePixDefault grava só as colunas do Pix (as regras financeiras da mesma linha ficam como estão).
func (r *pgRepository) SavePixDefault(ctx context.Context, orgID, userID uuid.UUID, a PixAccount) (*PixDefault, error) {
	_, err := r.db.Pool.Exec(ctx,
		`INSERT INTO organization_settings (organization_id, pix_key, pix_key_type, pix_receiver_name, pix_city, pix_updated_by, pix_updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,NOW())
		 ON CONFLICT (organization_id) DO UPDATE SET
		   pix_key=EXCLUDED.pix_key, pix_key_type=EXCLUDED.pix_key_type, pix_receiver_name=EXCLUDED.pix_receiver_name,
		   pix_city=EXCLUDED.pix_city, pix_updated_by=EXCLUDED.pix_updated_by, pix_updated_at=NOW()`,
		orgID, a.Key, a.KeyType, nilIfEmpty(a.ReceiverName), nilIfEmpty(a.City), userID)
	if err != nil {
		return nil, fmt.Errorf("settings.repo: save pix default: %w", err)
	}
	return r.GetPixDefault(ctx, orgID)
}

const unitPixCols = `a.unit_id, a.pix_key_type, a.pix_key, COALESCE(a.receiver_name, ''), a.confirmed_at`

func scanUnitPix(row pgx.Row) (*UnitPix, error) {
	var u UnitPix
	if err := row.Scan(&u.UnitID, &u.KeyType, &u.Key, &u.ReceiverName, &u.ConfirmedAt); err != nil {
		return nil, err
	}
	return &u, nil
}

// GetUnitPix só enxerga contas de unidades da organização (junta com o imóvel).
func (r *pgRepository) GetUnitPix(ctx context.Context, orgID, unitID uuid.UUID) (*UnitPix, error) {
	u, err := scanUnitPix(r.db.Pool.QueryRow(ctx,
		`SELECT `+unitPixCols+` FROM unit_pix_accounts a WHERE a.unit_id=$1 AND a.organization_id=$2 AND a.is_active`, unitID, orgID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("settings.repo: get unit pix: %w", err)
	}
	return u, nil
}

func (r *pgRepository) ListUnitPix(ctx context.Context, orgID uuid.UUID) ([]UnitPix, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT `+unitPixCols+` FROM unit_pix_accounts a WHERE a.organization_id=$1 AND a.is_active ORDER BY a.confirmed_at, a.unit_id`, orgID)
	if err != nil {
		return nil, fmt.Errorf("settings.repo: list unit pix: %w", err)
	}
	defer rows.Close()
	out := []UnitPix{}
	for rows.Next() {
		u, err := scanUnitPix(rows)
		if err != nil {
			return nil, fmt.Errorf("settings.repo: list unit pix: scan: %w", err)
		}
		out = append(out, *u)
	}
	return out, rows.Err()
}

// SaveUnitPix desativa a conta ativa e cria a nova na mesma transação. A unidade precisa ser da organização
// (confere pelo imóvel); caso contrário não grava e devolve apierr.ErrNotFound.
func (r *pgRepository) SaveUnitPix(ctx context.Context, orgID, unitID, userID uuid.UUID, a PixAccount) (*UnitPix, error) {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("settings.repo: save unit pix: begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var one int
	if err := tx.QueryRow(ctx,
		`SELECT 1 FROM units u JOIN properties p ON p.id=u.property_id WHERE u.id=$1 AND p.organization_id=$2 FOR UPDATE OF u`, unitID, orgID,
	).Scan(&one); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		return nil, fmt.Errorf("settings.repo: save unit pix: unit: %w", err)
	}
	if _, err := tx.Exec(ctx, `UPDATE unit_pix_accounts SET is_active=false, deactivated_at=NOW() WHERE unit_id=$1 AND is_active`, unitID); err != nil {
		return nil, fmt.Errorf("settings.repo: save unit pix: desativar: %w", err)
	}
	u, err := scanUnitPix(tx.QueryRow(ctx,
		`INSERT INTO unit_pix_accounts AS a (organization_id, unit_id, pix_key, pix_key_type, receiver_name, confirmed_by)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 RETURNING `+unitPixCols, orgID, unitID, a.Key, a.KeyType, nilIfEmpty(a.ReceiverName), userID))
	if err != nil {
		return nil, fmt.Errorf("settings.repo: save unit pix: inserir: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("settings.repo: save unit pix: commit: %w", err)
	}
	return u, nil
}

func (r *pgRepository) RemoveUnitPix(ctx context.Context, orgID, unitID uuid.UUID) error {
	tag, err := r.db.Pool.Exec(ctx,
		`UPDATE unit_pix_accounts SET is_active=false, deactivated_at=NOW() WHERE unit_id=$1 AND organization_id=$2 AND is_active`, unitID, orgID)
	if err != nil {
		return fmt.Errorf("settings.repo: remove unit pix: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return apierr.ErrNotFound
	}
	return nil
}

func (r *pgRepository) ListReminders(ctx context.Context, orgID uuid.UUID) ([]Reminder, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT name, offset_days, body FROM reminder_templates WHERE organization_id=$1 AND is_active ORDER BY offset_days`, orgID)
	if err != nil {
		return nil, fmt.Errorf("settings.repo: list reminders: %w", err)
	}
	defer rows.Close()
	out := []Reminder{}
	for rows.Next() {
		var m Reminder
		if err := rows.Scan(&m.Name, &m.OffsetDays, &m.Body); err != nil {
			return nil, fmt.Errorf("settings.repo: list reminders: scan: %w", err)
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// ReplaceReminders troca a lista ativa numa transação: se qualquer INSERT falhar, os lembretes atuais continuam.
func (r *pgRepository) ReplaceReminders(ctx context.Context, orgID, userID uuid.UUID, list []Reminder) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("settings.repo: replace reminders: begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if _, err := tx.Exec(ctx, `UPDATE reminder_templates SET is_active=false, deactivated_at=NOW() WHERE organization_id=$1 AND is_active`, orgID); err != nil {
		return fmt.Errorf("settings.repo: replace reminders: desativar: %w", err)
	}
	for _, m := range list {
		if _, err := tx.Exec(ctx,
			`INSERT INTO reminder_templates (organization_id, name, offset_days, body, created_by) VALUES ($1,$2,$3,$4,$5)`,
			orgID, m.Name, m.OffsetDays, m.Body, userID); err != nil {
			return fmt.Errorf("settings.repo: replace reminders: inserir: %w", err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("settings.repo: replace reminders: commit: %w", err)
	}
	return nil
}
