package report

import (
	"context"
	"fmt"
	"math"
	"regexp"
	"sort"
	"time"

	"github.com/google/uuid"
)

const minYear = 2000

type Service struct {
	repo Repository
	loc  *time.Location
	now  func() time.Time
}

func NewService(repo Repository) *Service {
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		loc = time.UTC
	}
	return &Service{repo: repo, loc: loc, now: time.Now}
}

func (s *Service) WithLocation(loc *time.Location) *Service {
	if loc != nil {
		s.loc = loc
	}
	return s
}

// WithClock troca o relógio (testes).
func (s *Service) WithClock(now func() time.Time) *Service {
	s.now = now
	return s
}

func round2(n float64) float64 { return math.Round(n*100) / 100 }

// period devolve o último mês completo do ano e o intervalo [from, to] a consultar.
func (s *Service) period(year int) (through int, from, to time.Time, err error) {
	now := s.now().In(s.loc)
	switch {
	case year < minYear || year > now.Year():
		return 0, from, to, ErrInvalidYear
	case year < now.Year():
		through = 12
	default:
		through = int(now.Month()) - 1
	}
	from = time.Date(year, time.January, 1, 0, 0, 0, 0, s.loc)
	to = time.Date(year, time.Month(through)+1, 0, 0, 0, 0, 0, s.loc)
	return through, from, to, nil
}

// Overview totaliza o ano mês a mês, de janeiro ao último mês completo.
func (s *Service) Overview(ctx context.Context, orgID uuid.UUID, year int) (*Overview, error) {
	through, from, to, err := s.period(year)
	if err != nil {
		return nil, err
	}
	o := &Overview{Year: year, ThroughMonth: through, Months: []MonthRow{}}
	if through == 0 {
		return o, nil
	}
	recv, err := s.repo.MonthlyReceived(ctx, orgID, from, to)
	if err != nil {
		return nil, fmt.Errorf("report.svc: recebido: %w", err)
	}
	exp, err := s.repo.MonthlyExpenses(ctx, orgID, from, to)
	if err != nil {
		return nil, fmt.Errorf("report.svc: despesas: %w", err)
	}
	r := map[string]MonthAmount{}
	for _, m := range recv {
		r[m.Month] = m
	}
	e := map[string]MonthAmount{}
	for _, m := range exp {
		e[m.Month] = m
	}
	for m := 1; m <= through; m++ {
		key := fmt.Sprintf("%04d-%02d", year, m)
		row := MonthRow{Month: key, Received: round2(r[key].Total), Expenses: round2(e[key].Total)}
		o.Months = append(o.Months, row)
		o.Totals.Received += row.Received
		o.Totals.Expenses += row.Expenses
		o.Totals.PaymentsCount += r[key].Count
	}
	o.Totals.Received = round2(o.Totals.Received)
	o.Totals.Expenses = round2(o.Totals.Expenses)
	o.Totals.Result = round2(o.Totals.Received - o.Totals.Expenses)
	return o, nil
}

// ByProperty totaliza o ano por unidade (só as com movimento), do maior resultado ao menor.
func (s *Service) ByProperty(ctx context.Context, orgID uuid.UUID, year int) (*ByProperty, error) {
	through, from, to, err := s.period(year)
	if err != nil {
		return nil, err
	}
	out := &ByProperty{Year: year, ThroughMonth: through, Rows: []UnitRow{}}
	if through == 0 {
		return out, nil
	}
	recv, err := s.repo.UnitReceived(ctx, orgID, from, to)
	if err != nil {
		return nil, fmt.Errorf("report.svc: recebido por unidade: %w", err)
	}
	exp, err := s.repo.UnitExpenses(ctx, orgID, from, to)
	if err != nil {
		return nil, fmt.Errorf("report.svc: despesas por unidade: %w", err)
	}
	rows := map[uuid.UUID]*UnitRow{}
	get := func(id uuid.UUID) *UnitRow {
		if rows[id] == nil {
			rows[id] = &UnitRow{UnitID: id}
		}
		return rows[id]
	}
	for _, u := range recv {
		get(u.UnitID).Received += u.Total
	}
	for _, u := range exp {
		get(u.UnitID).Expenses += u.Total
	}
	for _, row := range rows {
		row.Received, row.Expenses = round2(row.Received), round2(row.Expenses)
		row.Result = round2(row.Received - row.Expenses)
		out.Rows = append(out.Rows, *row)
		out.Totals.Received += row.Received
		out.Totals.Expenses += row.Expenses
	}
	sort.SliceStable(out.Rows, func(i, j int) bool {
		if out.Rows[i].Result != out.Rows[j].Result {
			return out.Rows[i].Result > out.Rows[j].Result
		}
		return out.Rows[i].UnitID.String() < out.Rows[j].UnitID.String()
	})
	out.Totals.Received = round2(out.Totals.Received)
	out.Totals.Expenses = round2(out.Totals.Expenses)
	out.Totals.Result = round2(out.Totals.Received - out.Totals.Expenses)
	return out, nil
}

var monthRe = regexp.MustCompile(`^\d{4}-(0[1-9]|1[0-2])$`)

// lastBusinessDay devolve o último dia útil (segunda a sexta, sem feriados) do mês de first.
func lastBusinessDay(first time.Time) time.Time {
	d := first.AddDate(0, 1, -1)
	for d.Weekday() == time.Saturday || d.Weekday() == time.Sunday {
		d = d.AddDate(0, 0, -1)
	}
	return d
}

// CarneLeao monta o relatório de um mês encerrado: rendimentos de pessoas físicas, despesas que entram,
// base estimada e prazo (último dia útil do mês seguinte).
func (s *Service) CarneLeao(ctx context.Context, orgID uuid.UUID, month string) (*CarneLeao, error) {
	if !monthRe.MatchString(month) {
		return nil, ErrInvalidMonth
	}
	first, err := time.ParseInLocation("2006-01", month, s.loc)
	if err != nil || first.Year() < minYear {
		return nil, ErrInvalidMonth
	}
	if month >= s.now().In(s.loc).Format("2006-01") {
		return nil, ErrMonthNotEnded
	}
	from, to := first, first.AddDate(0, 1, -1)

	income, err := s.repo.CarneIncome(ctx, orgID, from, to)
	if err != nil {
		return nil, fmt.Errorf("report.svc: rendimentos: %w", err)
	}
	deductions, err := s.repo.CarneDeductions(ctx, orgID, from, to, DeductibleCategories)
	if err != nil {
		return nil, fmt.Errorf("report.svc: despesas: %w", err)
	}
	c := &CarneLeao{
		Month:      month,
		DueDate:    lastBusinessDay(first.AddDate(0, 1, 0)).Format("2006-01-02"),
		Income:     IncomeSection{Lines: []IncomeLine{}},
		Deductions: DeductionSection{Lines: []DeductionLine{}},
	}
	for _, l := range income {
		c.Income.Lines = append(c.Income.Lines, l)
		c.Income.Total += l.Amount
	}
	for _, l := range deductions {
		c.Deductions.Lines = append(c.Deductions.Lines, l)
		c.Deductions.Total += l.Amount
	}
	c.Income.Count, c.Deductions.Count = len(c.Income.Lines), len(c.Deductions.Lines)
	c.Income.Total, c.Deductions.Total = round2(c.Income.Total), round2(c.Deductions.Total)
	c.Base = math.Max(0, round2(c.Income.Total-c.Deductions.Total))
	return c, nil
}
