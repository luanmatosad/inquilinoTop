package payment

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/jackc/pgx/v5"
)

var ErrNotFound = apierr.ErrNotFound

type pgRepository struct{ db *db.DB }

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

// NewEventStore devolve o armazenamento dos eventos da cobrança.
func NewEventStore(database *db.DB) EventStore {
	return &pgRepository{db: database}
}

const paymentCols = `id, organization_id, lease_id, due_date, paid_date,
  gross_amount, late_fee_amount, interest_amount, irrf_amount, net_amount,
  competency, description, status, type, created_at, updated_at,
  payment_method, discount_amount, payment_note, original_due_date, receipt_number, receipt_year`

func scanPayment(row pgx.Row, p *Payment) error {
	return row.Scan(&p.ID, &p.OrganizationID, &p.LeaseID, &p.DueDate, &p.PaidDate,
		&p.GrossAmount, &p.LateFeeAmount, &p.InterestAmount, &p.IRRFAmount, &p.NetAmount,
		&p.Competency, &p.Description, &p.Status, &p.Type, &p.CreatedAt, &p.UpdatedAt,
		&p.PaymentMethod, &p.DiscountAmount, &p.PaymentNote, &p.OriginalDueDate, &p.ReceiptNumber, &p.ReceiptYear)
}

func scanPaymentRows(rows pgx.Rows, p *Payment) error {
	return rows.Scan(&p.ID, &p.OrganizationID, &p.LeaseID, &p.DueDate, &p.PaidDate,
		&p.GrossAmount, &p.LateFeeAmount, &p.InterestAmount, &p.IRRFAmount, &p.NetAmount,
		&p.Competency, &p.Description, &p.Status, &p.Type, &p.CreatedAt, &p.UpdatedAt,
		&p.PaymentMethod, &p.DiscountAmount, &p.PaymentNote, &p.OriginalDueDate, &p.ReceiptNumber, &p.ReceiptYear)
}

func (r *pgRepository) Create(ctx context.Context, userID, orgID uuid.UUID, in CreatePaymentInput) (*Payment, error) {
	var p Payment
	err := scanPayment(r.db.Pool.QueryRow(ctx,
		`INSERT INTO payments (organization_id, owner_id, lease_id, due_date, gross_amount, type, competency, description)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		 RETURNING `+paymentCols,
		orgID, userID, in.LeaseID, in.DueDate, in.GrossAmount, in.Type, in.Competency, in.Description,
	), &p)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: create: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) CreateIfAbsent(ctx context.Context, userID, orgID uuid.UUID, in CreatePaymentInput) (*Payment, bool, error) {
	var p Payment
	err := scanPayment(r.db.Pool.QueryRow(ctx,
		`INSERT INTO payments (organization_id, owner_id, lease_id, due_date, gross_amount, type, competency, description)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		 ON CONFLICT (lease_id, competency, type) WHERE competency IS NOT NULL DO NOTHING
		 RETURNING `+paymentCols,
		orgID, userID, in.LeaseID, in.DueDate, in.GrossAmount, in.Type, in.Competency, in.Description,
	), &p)
	if err == nil {
		return &p, true, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, false, fmt.Errorf("payment.repo: create-if-absent: %w", err)
	}
	if in.Competency == nil {
		return nil, false, fmt.Errorf("payment.repo: create-if-absent: insert silently skipped without competency")
	}
	var existing Payment
	err = scanPayment(r.db.Pool.QueryRow(ctx,
		`SELECT `+paymentCols+`
		 FROM payments
		 WHERE lease_id=$1 AND competency=$2 AND type=$3 AND organization_id=$4`,
		in.LeaseID, *in.Competency, in.Type, orgID,
	), &existing)
	if err != nil {
		return nil, false, fmt.Errorf("payment.repo: create-if-absent lookup: %w", err)
	}
	return &existing, false, nil
}

func (r *pgRepository) GetByID(ctx context.Context, id, orgID uuid.UUID) (*Payment, error) {
	var p Payment
	err := scanPayment(r.db.Pool.QueryRow(ctx,
		`SELECT `+paymentCols+` FROM payments WHERE id=$1 AND organization_id=$2 AND is_active=true`,
		id, orgID,
	), &p)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		return nil, fmt.Errorf("payment.repo: get by id: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) ListByLease(ctx context.Context, leaseID, orgID uuid.UUID) ([]Payment, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT `+paymentCols+` FROM payments WHERE lease_id=$1 AND organization_id=$2 AND is_active=true ORDER BY due_date`,
		leaseID, orgID,
	)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: list by lease: %w", err)
	}
	defer rows.Close()
	var list []Payment
	for rows.Next() {
		var p Payment
		if err := scanPaymentRows(rows, &p); err != nil {
			return nil, fmt.Errorf("payment.repo: list scan: %w", err)
		}
		list = append(list, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("payment.repo: list rows: %w", err)
	}
	return list, nil
}

// List aplica os filtros em SQL. $1 é a organização e $2 a data de hoje; um status LATE guardado
// com vencimento futuro seria dado inconsistente, então "vencida" é sempre decidida pela data.
func (r *pgRepository) List(ctx context.Context, orgID uuid.UUID, f PaymentFilter, today time.Time) ([]Payment, error) {
	// "$2::date IS NOT NULL" mantém $2 referenciado em qualquer filtro (o Postgres rejeita parâmetro sobrando).
	query := `SELECT ` + paymentCols + ` FROM payments WHERE organization_id=$1 AND is_active=true AND $2::date IS NOT NULL`
	args := []interface{}{orgID, today}
	switch f.Status {
	case "PENDING":
		query += ` AND status<>'PAID' AND due_date >= $2`
	case "LATE":
		query += ` AND status<>'PAID' AND due_date < $2`
	case "PAID":
		query += ` AND status='PAID'`
	}
	if f.From != nil {
		args = append(args, *f.From)
		query += fmt.Sprintf(` AND due_date >= $%d`, len(args))
	}
	if f.To != nil {
		args = append(args, *f.To)
		query += fmt.Sprintf(` AND due_date <= $%d`, len(args))
	}
	if f.LeaseID != nil {
		args = append(args, *f.LeaseID)
		query += fmt.Sprintf(` AND lease_id = $%d`, len(args))
	}
	query += ` ORDER BY due_date DESC, created_at DESC`

	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: list: %w", err)
	}
	defer rows.Close()
	var list []Payment
	for rows.Next() {
		var p Payment
		if err := scanPaymentRows(rows, &p); err != nil {
			return nil, fmt.Errorf("payment.repo: list scan: %w", err)
		}
		list = append(list, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("payment.repo: list rows: %w", err)
	}
	return list, nil
}

func (r *pgRepository) Update(ctx context.Context, id, orgID uuid.UUID, in UpdatePaymentInput) (*Payment, error) {
	var p Payment
	err := scanPayment(r.db.Pool.QueryRow(ctx,
		`UPDATE payments SET paid_date=$1, status=$2, gross_amount=$3, updated_at=NOW()
		 WHERE id=$4 AND organization_id=$5
		 RETURNING `+paymentCols,
		in.PaidDate, in.Status, in.GrossAmount, id, orgID,
	), &p)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: update: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) MarkPaid(ctx context.Context, id, orgID uuid.UUID, in PaidInput) (*Payment, error) {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: mark paid: begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var p Payment
	err = scanPayment(tx.QueryRow(ctx,
		`UPDATE payments
		 SET paid_date=$1, status='PAID',
		     late_fee_amount=$2, interest_amount=$3, irrf_amount=$4, net_amount=$5,
		     discount_amount=$6, payment_method=$7, payment_note=$8,
		     updated_at=NOW()
		 WHERE id=$9 AND organization_id=$10
		 RETURNING `+paymentCols,
		in.PaidDate, in.LateFee, in.Interest, in.IRRF, in.Net, in.Discount, in.Method, in.Note, id, orgID,
	), &p)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("payment.repo: mark paid: %w", err)
	}

	if err := assignReceiptNumber(ctx, tx, &p); err != nil {
		return nil, err
	}

	data := map[string]any{"amount": in.Net, "discount": in.Discount, "paid_date": in.PaidDate.Format("2006-01-02")}
	if in.Method != nil {
		data["method"] = *in.Method
	}
	raw, _ := json.Marshal(data)
	if _, err := tx.Exec(ctx,
		`INSERT INTO payment_events (organization_id, payment_id, kind, data, actor_id) VALUES ($1,$2,'PAID',$3::jsonb,$4)`,
		orgID, id, string(raw), in.ActorID,
	); err != nil {
		return nil, fmt.Errorf("payment.repo: mark paid: event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("payment.repo: mark paid: commit: %w", err)
	}
	return &p, nil
}

// assignReceiptNumber tira o próximo número da organização para o ano do pagamento, de forma atômica, e o grava em p.
func assignReceiptNumber(ctx context.Context, tx pgx.Tx, p *Payment) error {
	if p.PaidDate == nil {
		return nil
	}
	year := p.PaidDate.Year()
	var n int
	if err := tx.QueryRow(ctx,
		`INSERT INTO receipt_counters (organization_id, year, last_number) VALUES ($1,$2,1)
		 ON CONFLICT (organization_id, year) DO UPDATE SET last_number = receipt_counters.last_number + 1
		 RETURNING last_number`, p.OrganizationID, year,
	).Scan(&n); err != nil {
		return fmt.Errorf("payment.repo: receipt counter: %w", err)
	}
	if _, err := tx.Exec(ctx,
		`UPDATE payments SET receipt_number=$1, receipt_year=$2 WHERE id=$3 AND organization_id=$4`,
		n, year, p.ID, p.OrganizationID,
	); err != nil {
		return fmt.Errorf("payment.repo: receipt number: %w", err)
	}
	p.ReceiptNumber, p.ReceiptYear = &n, &year
	return nil
}

func (r *pgRepository) EnsureReceiptNumber(ctx context.Context, id, orgID uuid.UUID) (*Payment, error) {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: ensure receipt: begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var p Payment
	err = scanPayment(tx.QueryRow(ctx,
		`SELECT `+paymentCols+` FROM payments WHERE id=$1 AND organization_id=$2 FOR UPDATE`, id, orgID), &p)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("payment.repo: ensure receipt: %w", err)
	}
	if p.ReceiptNumber == nil && p.Status == "PAID" {
		if err := assignReceiptNumber(ctx, tx, &p); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("payment.repo: ensure receipt: commit: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) UpdateChargeInfo(ctx context.Context, id, orgID uuid.UUID, in UpdateChargeInfoInput) error {
	_, err := r.db.Pool.Exec(ctx,
		`UPDATE payments SET charge_id = $3, charge_method = $4, charge_qrcode = $5, charge_link = $6, charge_barcode = $7, updated_at = NOW()
		 WHERE id = $1 AND organization_id = $2`,
		id, orgID, in.ChargeID, in.ChargeMethod, in.QRCode, in.Link, in.BarCode,
	)
	return err
}

func (r *pgRepository) UpdatePayoutInfo(ctx context.Context, id, orgID uuid.UUID, payoutID, status string) error {
	_, err := r.db.Pool.Exec(ctx,
		`UPDATE payments SET payout_id = $3, payout_status = $4, updated_at = NOW()
		 WHERE id = $1 AND organization_id = $2`,
		id, orgID, payoutID, status,
	)
	return err
}

func (r *pgRepository) GetByChargeID(ctx context.Context, chargeID string) (*Payment, error) {
	var p Payment
	err := scanPayment(r.db.Pool.QueryRow(ctx,
		`SELECT `+paymentCols+` FROM payments WHERE charge_id = $1`,
		chargeID,
	), &p)
	if err == pgx.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("payment.repo: get by charge id: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) UpdateFuturePendingRent(ctx context.Context, leaseID, orgID uuid.UUID, from time.Time, amount float64) (RentUpdateResult, error) {
	var res RentUpdateResult
	tag, err := r.db.Pool.Exec(ctx,
		`UPDATE payments SET gross_amount=$1, updated_at=NOW()
		 WHERE lease_id=$2 AND organization_id=$3 AND is_active=true
		   AND type='RENT' AND status='PENDING' AND due_date >= $4 AND charge_id IS NULL`,
		amount, leaseID, orgID, from,
	)
	if err != nil {
		return res, fmt.Errorf("payment.repo: update future pending rent: %w", err)
	}
	res.Updated = int(tag.RowsAffected())
	err = r.db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM payments
		 WHERE lease_id=$1 AND organization_id=$2 AND is_active=true
		   AND type='RENT' AND status='PENDING' AND due_date >= $3 AND charge_id IS NOT NULL`,
		leaseID, orgID, from,
	).Scan(&res.NeedsReview)
	if err != nil {
		return res, fmt.Errorf("payment.repo: count needs review: %w", err)
	}
	return res, nil
}

func (r *pgRepository) DeactivateFuturePending(ctx context.Context, leaseID, orgID uuid.UUID, after time.Time) (DeactivateResult, error) {
	var res DeactivateResult
	tag, err := r.db.Pool.Exec(ctx,
		`UPDATE payments SET is_active=false, updated_at=NOW()
		 WHERE lease_id=$1 AND organization_id=$2 AND is_active=true
		   AND status='PENDING' AND due_date > $3 AND charge_id IS NULL`,
		leaseID, orgID, after,
	)
	if err != nil {
		return res, fmt.Errorf("payment.repo: deactivate future pending: %w", err)
	}
	res.Deactivated = int(tag.RowsAffected())
	err = r.db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM payments
		 WHERE lease_id=$1 AND organization_id=$2 AND is_active=true
		   AND status='PENDING' AND due_date > $3 AND charge_id IS NOT NULL`,
		leaseID, orgID, after,
	).Scan(&res.NeedsReview)
	if err != nil {
		return res, fmt.Errorf("payment.repo: count needs review: %w", err)
	}
	return res, nil
}

// AddEvent grava um evento imutável da cobrança.
func (r *pgRepository) AddEvent(ctx context.Context, orgID, paymentID uuid.UUID, actorID *uuid.UUID, kind string, channel *string, data map[string]any) (*Event, error) {
	if data == nil {
		data = map[string]any{}
	}
	raw, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: add event: marshal: %w", err)
	}
	var e Event
	var rawOut []byte
	err = r.db.Pool.QueryRow(ctx,
		`INSERT INTO payment_events (organization_id, payment_id, kind, channel, data, actor_id)
		 SELECT $1, p.id, $3, $4, $5::jsonb, $6 FROM payments p WHERE p.id=$2 AND p.organization_id=$1
		 RETURNING id, payment_id, kind, channel, data, actor_id, occurred_at`,
		orgID, paymentID, kind, channel, string(raw), actorID,
	).Scan(&e.ID, &e.PaymentID, &e.Kind, &e.Channel, &rawOut, &e.ActorID, &e.OccurredAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("payment.repo: add event: %w", err)
	}
	_ = json.Unmarshal(rawOut, &e.Data)
	return &e, nil
}

// ListEvents devolve os eventos da cobrança em ordem cronológica; outra organização recebe lista vazia.
func (r *pgRepository) ListEvents(ctx context.Context, paymentID, orgID uuid.UUID) ([]Event, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, payment_id, kind, channel, data, actor_id, occurred_at
		 FROM payment_events WHERE payment_id=$1 AND organization_id=$2
		 ORDER BY occurred_at, id`, paymentID, orgID)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: list events: %w", err)
	}
	defer rows.Close()
	out := []Event{}
	for rows.Next() {
		var e Event
		var raw []byte
		if err := rows.Scan(&e.ID, &e.PaymentID, &e.Kind, &e.Channel, &raw, &e.ActorID, &e.OccurredAt); err != nil {
			return nil, fmt.Errorf("payment.repo: list events: scan: %w", err)
		}
		_ = json.Unmarshal(raw, &e.Data)
		out = append(out, e)
	}
	return out, rows.Err()
}

func (r *pgRepository) ApplyAgreement(ctx context.Context, id, orgID uuid.UUID, in AgreementApply) (*Payment, error) {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: agreement: begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var p Payment
	err = scanPayment(tx.QueryRow(ctx,
		`UPDATE payments
		 SET due_date=$1, gross_amount=$2, original_due_date=COALESCE(original_due_date, $3::date), updated_at=NOW()
		 WHERE id=$4 AND organization_id=$5 AND status <> 'PAID' AND charge_id IS NULL AND is_active=true
		 RETURNING `+paymentCols,
		in.NewDueDate, in.NewGross, in.OldDueDate, id, orgID,
	), &p)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("payment.repo: agreement: %w", err)
	}

	data := map[string]any{
		"old_due_date": in.OldDueDate.Format("2006-01-02"),
		"new_due_date": in.NewDueDate.Format("2006-01-02"),
		"old_amount":   in.OldGross,
		"new_amount":   in.NewGross,
	}
	if in.Note != nil && *in.Note != "" {
		data["note"] = *in.Note
	}
	raw, _ := json.Marshal(data)
	if _, err := tx.Exec(ctx,
		`INSERT INTO payment_events (organization_id, payment_id, kind, data, actor_id) VALUES ($1,$2,'AGREEMENT',$3::jsonb,$4)`,
		orgID, id, string(raw), in.ActorID,
	); err != nil {
		return nil, fmt.Errorf("payment.repo: agreement: event: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("payment.repo: agreement: commit: %w", err)
	}
	return &p, nil
}
