package fiscal

import (
	"context"
	"fmt"
	"time"

	"github.com/inquilinotop/api/pkg/db"
)

type pgBracketsRepository struct{ db *db.DB }

func NewBracketsRepository(database *db.DB) BracketsRepository {
	return &pgBracketsRepository{db: database}
}

func (r *pgBracketsRepository) ActiveBrackets(ctx context.Context, at time.Time) ([]IRRFBracket, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, valid_from, min_base, max_base, rate, deduction
		 FROM irrf_brackets
		 WHERE valid_from = (
		   SELECT MAX(valid_from) FROM irrf_brackets WHERE valid_from <= $1
		 )
		 ORDER BY min_base`, at,
	)
	if err != nil {
		return nil, fmt.Errorf("fiscal.brackets.repo: %w", err)
	}
	defer rows.Close()
	var list []IRRFBracket
	for rows.Next() {
		var b IRRFBracket
		if err := rows.Scan(&b.ID, &b.ValidFrom, &b.MinBase, &b.MaxBase, &b.Rate, &b.Deduction); err != nil {
			return nil, fmt.Errorf("fiscal.brackets.repo: scan: %w", err)
		}
		list = append(list, b)
	}
	return list, rows.Err()
}
