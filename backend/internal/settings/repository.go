package settings

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
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
