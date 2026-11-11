package financial

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/jackc/pgx/v5"
)

type pgRepository struct {
	db *db.DB
}

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

func (r *pgRepository) AdminFeePercent(ctx context.Context, orgID uuid.UUID) (float64, error) {
	var pct float64
	err := r.db.Pool.QueryRow(ctx,
		`SELECT COALESCE((SELECT admin_fee_percent FROM organization_settings WHERE organization_id=$1), 0)::float8`,
		orgID,
	).Scan(&pct)
	if err != nil {
		return 0, fmt.Errorf("financial.repository: taxa administrativa: %w", err)
	}
	return pct, nil
}

// PaidRentByProperty soma aluguéis PAID com vencimento na competência, por imóvel.
func (r *pgRepository) PaidRentByProperty(ctx context.Context, orgID uuid.UUID, period string) ([]PropertyGross, error) {
	start, err := time.Parse("2006-01", period)
	if err != nil {
		return nil, ErrInvalidPeriod
	}
	end := start.AddDate(0, 1, 0)

	rows, err := r.db.Pool.Query(ctx,
		`SELECT u.property_id, ROUND(SUM(p.gross_amount)::numeric, 2)::float8
		 FROM payments p
		 JOIN leases l     ON l.id = p.lease_id AND l.is_active
		 JOIN units u      ON u.id = l.unit_id AND u.is_active
		 JOIN properties pr ON pr.id = u.property_id AND pr.organization_id = $1 AND pr.is_active
		 WHERE p.organization_id = $1
		   AND p.is_active
		   AND p.status = 'PAID'
		   AND p.type = 'RENT'
		   AND p.due_date >= $2::date
		   AND p.due_date <  $3::date
		 GROUP BY u.property_id`,
		orgID, start, end,
	)
	if err != nil {
		return nil, fmt.Errorf("financial.repository: aluguel pago: %w", err)
	}
	defer rows.Close()

	var out []PropertyGross
	for rows.Next() {
		var g PropertyGross
		if err := rows.Scan(&g.PropertyID, &g.Gross); err != nil {
			return nil, fmt.Errorf("financial.repository: scan aluguel pago: %w", err)
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

// InsertTransfers grava em transação; repasses já existentes (imóvel + competência) são ignorados.
func (r *pgRepository) InsertTransfers(ctx context.Context, orgID uuid.UUID, period string, rows []Transfer) (int, error) {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("financial.repository: iniciar transação: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	inserted := 0
	for _, t := range rows {
		tag, err := tx.Exec(ctx,
			`INSERT INTO transfers (organization_id, property_id, period, gross_amount, admin_fee_percent,
			                        admin_fee_amount, discounts, net_amount, status)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			 ON CONFLICT (organization_id, property_id, period) WHERE is_active DO NOTHING`,
			orgID, t.PropertyID, period, t.GrossAmount, t.AdminFeePercent,
			t.AdminFeeAmount, t.Discounts, t.NetAmount, t.Status,
		)
		if err != nil {
			return 0, fmt.Errorf("financial.repository: inserir repasse: %w", err)
		}
		inserted += int(tag.RowsAffected())
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("financial.repository: commit repasses: %w", err)
	}
	return inserted, nil
}

const transferSelect = `
SELECT t.id, t.property_id, pr.name, COALESCE(NULLIF(TRIM(up.full_name), ''), u.email, ''),
       t.period, t.gross_amount::float8, t.admin_fee_percent::float8, t.admin_fee_amount::float8,
       t.discounts::float8, t.net_amount::float8, t.status, t.transferred_at, t.created_at, t.updated_at
FROM transfers t
JOIN properties pr      ON pr.id = t.property_id
LEFT JOIN users u       ON u.id = pr.owner_id
LEFT JOIN user_profiles up ON up.user_id = u.id`

func scanTransfer(row pgx.Row) (Transfer, error) {
	var t Transfer
	err := row.Scan(&t.ID, &t.PropertyID, &t.PropertyName, &t.OwnerName,
		&t.Period, &t.GrossAmount, &t.AdminFeePercent, &t.AdminFeeAmount,
		&t.Discounts, &t.NetAmount, &t.Status, &t.TransferredAt, &t.CreatedAt, &t.UpdatedAt)
	return t, err
}

func (r *pgRepository) ListTransfers(ctx context.Context, orgID uuid.UUID, f TransferFilter) ([]Transfer, error) {
	rows, err := r.db.Pool.Query(ctx, transferSelect+`
		WHERE t.organization_id = $1
		  AND t.is_active
		  AND ($2 = '' OR t.status = $2)
		  AND ($3 = '' OR t.period >= $3)
		  AND ($4 = '' OR t.period <= $4)
		  AND ($5::uuid IS NULL OR t.property_id = $5)
		ORDER BY t.period DESC, pr.name`,
		orgID, f.Status, f.From, f.To, f.PropertyID,
	)
	if err != nil {
		return nil, fmt.Errorf("financial.repository: listar repasses: %w", err)
	}
	defer rows.Close()

	out := []Transfer{}
	for rows.Next() {
		t, err := scanTransfer(rows)
		if err != nil {
			return nil, fmt.Errorf("financial.repository: scan repasse: %w", err)
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *pgRepository) GetTransfer(ctx context.Context, id, orgID uuid.UUID) (*Transfer, error) {
	t, err := scanTransfer(r.db.Pool.QueryRow(ctx, transferSelect+
		` WHERE t.id = $1 AND t.organization_id = $2 AND t.is_active`, id, orgID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		return nil, fmt.Errorf("financial.repository: buscar repasse: %w", err)
	}
	return &t, nil
}

func (r *pgRepository) SaveTransfer(ctx context.Context, orgID uuid.UUID, t *Transfer, expectedStatus string) error {
	var updatedAt time.Time
	err := r.db.Pool.QueryRow(ctx,
		`UPDATE transfers
		 SET discounts = $3, net_amount = $4, status = $5, transferred_at = $6, updated_at = NOW()
		 WHERE id = $1 AND organization_id = $2 AND status = $7 AND is_active
		 RETURNING updated_at`,
		t.ID, orgID, t.Discounts, t.NetAmount, t.Status, t.TransferredAt, expectedStatus,
	).Scan(&updatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrConcurrentUpdate
		}
		return fmt.Errorf("financial.repository: gravar repasse: %w", err)
	}
	t.UpdatedAt = updatedAt
	return nil
}

// InsertBankRecord: inserção simples; se a linha já existe, devolve o id existente com inserted=false.
func (r *pgRepository) InsertBankRecord(ctx context.Context, orgID uuid.UUID, in BankRecordInput) (uuid.UUID, bool, error) {
	var id uuid.UUID
	err := r.db.Pool.QueryRow(ctx,
		`INSERT INTO bank_records (organization_id, record_date, description, amount, type)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (organization_id, record_date, description, amount, type) WHERE is_active DO NOTHING
		 RETURNING id`,
		orgID, in.Date, in.Description, in.Amount, in.Type,
	).Scan(&id)
	if err == nil {
		return id, true, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, false, fmt.Errorf("financial.repository: inserir lançamento: %w", err)
	}
	err = r.db.Pool.QueryRow(ctx,
		`SELECT id FROM bank_records
		 WHERE organization_id = $1 AND record_date = $2 AND description = $3 AND amount = $4 AND type = $5 AND is_active`,
		orgID, in.Date, in.Description, in.Amount, in.Type,
	).Scan(&id)
	if err != nil {
		return uuid.Nil, false, fmt.Errorf("financial.repository: buscar lançamento existente: %w", err)
	}
	return id, false, nil
}

// MatchBankRecord concilia um CREDIT sem vínculo com o pagamento PAID mais próximo (±1 dia, ±5% do valor,
// pagamento ainda não conciliado). Se o lançamento já tem vínculo, devolve esse vínculo.
func (r *pgRepository) MatchBankRecord(ctx context.Context, orgID, recordID uuid.UUID) (*uuid.UUID, error) {
	var pid *uuid.UUID
	err := r.db.Pool.QueryRow(ctx,
		`UPDATE bank_records b
		 SET payment_id = (
		   SELECT p.id FROM payments p
		   WHERE p.organization_id = b.organization_id
		     AND p.is_active
		     AND p.status = 'PAID'
		     AND p.due_date BETWEEN b.record_date - 1 AND b.record_date + 1
		     AND ABS(p.gross_amount - b.amount) <= ROUND(b.amount * 0.05, 2)
		     AND NOT EXISTS (SELECT 1 FROM bank_records o WHERE o.payment_id = p.id AND o.is_active)
		   ORDER BY ABS(p.gross_amount - b.amount), ABS(p.due_date - b.record_date)
		   LIMIT 1
		 )
		 WHERE b.id = $1 AND b.organization_id = $2 AND b.type = 'CREDIT' AND b.payment_id IS NULL AND b.is_active
		 RETURNING b.payment_id`,
		recordID, orgID,
	).Scan(&pid)
	if err == nil {
		return pid, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("financial.repository: conciliar lançamento: %w", err)
	}
	// Já tinha vínculo, ou é débito: devolve o estado atual.
	err = r.db.Pool.QueryRow(ctx,
		`SELECT payment_id FROM bank_records WHERE id = $1 AND organization_id = $2 AND is_active`,
		recordID, orgID,
	).Scan(&pid)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		return nil, fmt.Errorf("financial.repository: estado do lançamento: %w", err)
	}
	return pid, nil
}

func (r *pgRepository) ListBankRecords(ctx context.Context, orgID uuid.UUID, f BankRecordFilter) ([]BankRecord, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, record_date, description, amount::float8, type, payment_id
		 FROM bank_records
		 WHERE organization_id = $1 AND is_active
		   AND ($2::date IS NULL OR record_date >= $2::date)
		   AND ($3::date IS NULL OR record_date <= $3::date)
		 ORDER BY record_date DESC, description`,
		orgID, f.From, f.To,
	)
	if err != nil {
		return nil, fmt.Errorf("financial.repository: listar lançamentos: %w", err)
	}
	defer rows.Close()

	out := []BankRecord{}
	for rows.Next() {
		var b BankRecord
		if err := rows.Scan(&b.ID, &b.Date, &b.Description, &b.Amount, &b.Type, &b.PaymentID); err != nil {
			return nil, fmt.Errorf("financial.repository: scan lançamento: %w", err)
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// SetAdminFeePercent grava só a taxa; demais colunas de organization_settings mantêm padrão ou valor atual.
func (r *pgRepository) SetAdminFeePercent(ctx context.Context, orgID uuid.UUID, pct float64) error {
	_, err := r.db.Pool.Exec(ctx,
		`INSERT INTO organization_settings (organization_id, admin_fee_percent)
		 VALUES ($1, $2)
		 ON CONFLICT (organization_id) DO UPDATE SET admin_fee_percent = EXCLUDED.admin_fee_percent, updated_at = NOW()`,
		orgID, pct,
	)
	if err != nil {
		return fmt.Errorf("financial.repository: gravar taxa administrativa: %w", err)
	}
	return nil
}
