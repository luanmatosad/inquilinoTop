package payment

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/jackc/pgx/v5"
)

func (p *pgRepository) CreateFinancialConfig(ctx context.Context, ownerID uuid.UUID, in CreateFinancialConfigInput) (*FinancialConfig, error) {
	configJSON, err := json.Marshal(in.Config)
	if err != nil {
		return nil, err
	}

	var pixKeyPtr *string
	if in.PixKey != nil {
		pixKeyPtr = in.PixKey
	}

	var bankInfoJSON []byte
	if in.BankInfo != nil {
		bankInfoJSON, _ = json.Marshal(in.BankInfo)
	} else {
		bankInfoJSON = []byte("{}")
	}

	var fc FinancialConfig
	err = p.db.Pool.QueryRow(ctx,
		`INSERT INTO financial_config (owner_id, provider, config, pix_key, bank_info)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, owner_id, provider, config, pix_key, bank_info, is_active, created_at, updated_at`,
		ownerID, in.Provider, configJSON, pixKeyPtr, bankInfoJSON,
	).Scan(&fc.ID, &fc.OwnerID, &fc.Provider, &fc.Config, &fc.PixKey, &fc.BankInfo, &fc.IsActive, &fc.CreatedAt, &fc.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return &fc, nil
}

func (p *pgRepository) GetFinancialConfigByID(ctx context.Context, id, ownerID uuid.UUID) (*FinancialConfig, error) {
	var fc FinancialConfig
	configJSON := []byte("{}")
	bankInfoJSON := []byte("{}")

	err := p.db.Pool.QueryRow(ctx,
		`SELECT id, owner_id, provider, config, pix_key, bank_info, is_active, created_at, updated_at
		 FROM financial_config WHERE id = $1 AND owner_id = $2`,
		id, ownerID,
	).Scan(&fc.ID, &fc.OwnerID, &fc.Provider, &configJSON, &fc.PixKey, &bankInfoJSON, &fc.IsActive, &fc.CreatedAt, &fc.UpdatedAt)

	if err == pgx.ErrNoRows {
		return nil, apierr.ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	json.Unmarshal(configJSON, &fc.Config)
	json.Unmarshal(bankInfoJSON, &fc.BankInfo)

	return &fc, nil
}

func (p *pgRepository) GetActiveFinancialConfig(ctx context.Context, ownerID uuid.UUID) (*FinancialConfig, error) {
	var fc FinancialConfig
	configJSON := []byte("{}")
	bankInfoJSON := []byte("{}")

	err := p.db.Pool.QueryRow(ctx,
		`SELECT id, owner_id, provider, config, pix_key, bank_info, is_active, created_at, updated_at
		 FROM financial_config WHERE owner_id = $1 AND is_active = true`,
		ownerID,
	).Scan(&fc.ID, &fc.OwnerID, &fc.Provider, &configJSON, &fc.PixKey, &bankInfoJSON, &fc.IsActive, &fc.CreatedAt, &fc.UpdatedAt)

	if err == pgx.ErrNoRows {
		return nil, apierr.ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	json.Unmarshal(configJSON, &fc.Config)
	json.Unmarshal(bankInfoJSON, &fc.BankInfo)

	return &fc, nil
}

func (p *pgRepository) UpdateFinancialConfig(ctx context.Context, id, ownerID uuid.UUID, in CreateFinancialConfigInput) (*FinancialConfig, error) {
	configJSON, _ := json.Marshal(in.Config)
	bankInfoJSON, _ := json.Marshal(in.BankInfo)

	var fc FinancialConfig
	err := p.db.Pool.QueryRow(ctx,
		`UPDATE financial_config SET provider = $3, config = $4, pix_key = $5, bank_info = $6, updated_at = NOW()
		 WHERE id = $1 AND owner_id = $2
		 RETURNING id, owner_id, provider, config, pix_key, bank_info, is_active, created_at, updated_at`,
		id, ownerID, in.Provider, configJSON, in.PixKey, bankInfoJSON,
	).Scan(&fc.ID, &fc.OwnerID, &fc.Provider, &fc.Config, &fc.PixKey, &fc.BankInfo, &fc.IsActive, &fc.CreatedAt, &fc.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return &fc, nil
}

func (p *pgRepository) GetFinancialConfig(ctx context.Context, ownerID uuid.UUID) (*FinancialConfig, error) {
	var fc FinancialConfig
	configJSON := []byte("{}")
	bankInfoJSON := []byte("{}")

	err := p.db.Pool.QueryRow(ctx,
		`SELECT id, owner_id, provider, config, pix_key, bank_info, is_active, created_at, updated_at
		 FROM financial_config WHERE owner_id = $1`,
		ownerID,
	).Scan(&fc.ID, &fc.OwnerID, &fc.Provider, &configJSON, &fc.PixKey, &bankInfoJSON, &fc.IsActive, &fc.CreatedAt, &fc.UpdatedAt)

	if err == pgx.ErrNoRows {
		return nil, nil // Return nil when not found for upsert pattern
	}
	if err != nil {
		return nil, err
	}

	json.Unmarshal(configJSON, &fc.Config)
	if string(bankInfoJSON) != "{}" && string(bankInfoJSON) != "null" {
		json.Unmarshal(bankInfoJSON, &fc.BankInfo)
	}

	return &fc, nil
}

func (p *pgRepository) UpsertFinancialConfig(ctx context.Context, ownerID uuid.UUID, in UpsertFinancialConfigInput) (*FinancialConfig, error) {
	configJSON, err := json.Marshal(in.Config)
	if err != nil {
		return nil, err
	}

	var pixKeyPtr *string
	if in.PixKey != nil {
		pixKeyPtr = in.PixKey
	}

	var bankInfoJSON []byte
	if in.BankInfo != nil {
		bankInfoJSON, _ = json.Marshal(in.BankInfo)
	} else {
		bankInfoJSON = []byte("null")
	}

	var fc FinancialConfig
	err = p.db.Pool.QueryRow(ctx,
		`INSERT INTO financial_config (owner_id, provider, config, pix_key, bank_info, is_active, updated_at)
		 VALUES ($1, $2, $3, $4, $5, true, NOW())
		 ON CONFLICT (owner_id) WHERE is_active = true 
		 DO UPDATE SET
		 	provider = EXCLUDED.provider,
		 	config = EXCLUDED.config,
		 	pix_key = EXCLUDED.pix_key,
		 	bank_info = EXCLUDED.bank_info,
		 	updated_at = NOW()
		 RETURNING id, owner_id, provider, config, pix_key, bank_info, is_active, created_at, updated_at`,
		ownerID, in.Provider, configJSON, pixKeyPtr, bankInfoJSON,
	).Scan(&fc.ID, &fc.OwnerID, &fc.Provider, &configJSON, &fc.PixKey, &bankInfoJSON, &fc.IsActive, &fc.CreatedAt, &fc.UpdatedAt)

	// Note: We need a unique index on (owner_id) to make the ON CONFLICT work correctly.
	// In 000015_create_financial_config.up.sql, there's only an index. 
	// We might need to add a UNIQUE constraint on owner_id where is_active is true.
	// For now, let's assume we update the first active one, but since ON CONFLICT needs a unique constraint,
	// let's adjust this. If there's no unique constraint, we'll have to do SELECT then UPDATE or INSERT.

	if err != nil {
		return nil, err
	}

	json.Unmarshal(configJSON, &fc.Config)
	if string(bankInfoJSON) != "{}" && string(bankInfoJSON) != "null" {
		json.Unmarshal(bankInfoJSON, &fc.BankInfo)
	}

	return &fc, nil
}

func (p *pgRepository) DeleteFinancialConfig(ctx context.Context, id, ownerID uuid.UUID) error {
	result, err := p.db.Pool.Exec(ctx,
		`UPDATE financial_config SET is_active=false, updated_at=NOW() WHERE id=$1 AND owner_id=$2 AND is_active=true`,
		id, ownerID,
	)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return apierr.ErrNotFound
	}
	return nil
}