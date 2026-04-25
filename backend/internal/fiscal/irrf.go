package fiscal

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"
)

type irrfTable struct {
	repo BracketsRepository
}

func NewIRRFTable(repo BracketsRepository) IRRFTable {
	return &irrfTable{repo: repo}
}

func (t *irrfTable) Calculate(ctx context.Context, base float64, at time.Time) (float64, error) {
	if base < 0 {
		return 0, fmt.Errorf("fiscal.irrf: base negativa")
	}
	brackets, err := t.repo.ActiveBrackets(ctx, at)
	if err != nil {
		return 0, fmt.Errorf("fiscal.irrf: load brackets: %w", err)
	}
	if len(brackets) == 0 {
		return 0, fmt.Errorf("fiscal.irrf: sem faixas válidas para %s", at.Format("2006-01-02"))
	}
	sort.Slice(brackets, func(i, j int) bool { return brackets[i].ValidFrom.After(brackets[j].ValidFrom) })
	latest := brackets[0].ValidFrom
	for _, b := range brackets {
		if !b.ValidFrom.Equal(latest) {
			continue
		}
		if base < b.MinBase {
			continue
		}
		if b.MaxBase != nil && base > *b.MaxBase {
			continue
		}
		v := base*b.Rate - b.Deduction
		if v < 0 {
			v = 0
		}
		return math.Round(v*100) / 100, nil
	}
	return 0, fmt.Errorf("fiscal.irrf: sem faixa para base %.2f em %s", base, at.Format("2006-01-02"))
}
