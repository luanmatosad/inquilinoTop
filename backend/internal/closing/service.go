package closing

import (
	"context"
	"errors"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
)

var monthRe = regexp.MustCompile(`^\d{4}-(0[1-9]|1[0-2])$`)

type Service struct {
	repo  Repository
	src   PaymentSource
	names NameReader
	loc   *time.Location
	now   func() time.Time
}

func NewService(repo Repository, src PaymentSource, names NameReader) *Service {
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		loc = time.UTC
	}
	return &Service{repo: repo, src: src, names: names, loc: loc, now: time.Now}
}

// WithLocation define o fuso do fechamento (padrão America/Sao_Paulo).
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

func (s *Service) monthRange(month string) (time.Time, time.Time, error) {
	if !monthRe.MatchString(month) {
		return time.Time{}, time.Time{}, ErrInvalidMonth
	}
	first, err := time.ParseInLocation("2006-01", month, s.loc)
	if err != nil {
		return time.Time{}, time.Time{}, ErrInvalidMonth
	}
	return first, first.AddDate(0, 1, -1), nil
}

// snapshot calcula os números do mês com o mesmo critério de Recebimentos (valor bruto).
func (s *Service) snapshot(ctx context.Context, orgID uuid.UUID, month string) (Snapshot, error) {
	from, to, err := s.monthRange(month)
	if err != nil {
		return Snapshot{}, err
	}
	facts, err := s.src.RentOfMonth(ctx, orgID, from, to)
	if err != nil {
		return Snapshot{}, fmt.Errorf("closing.svc: cobranças do mês: %w", err)
	}
	snap := Snapshot{Pending: []Pending{}}
	for _, f := range facts {
		snap.Forecast.Count++
		snap.Forecast.Total += f.Gross
		if f.Paid {
			snap.Received.Count++
			snap.Received.Total += f.Gross
			if f.HasReceipt {
				snap.ReceiptsIssued++
			}
			continue
		}
		snap.Overdue.Count++
		snap.Overdue.Total += f.Gross
		snap.Pending = append(snap.Pending, Pending{
			PaymentID: f.ID, Tenant: f.Tenant, Amount: f.Gross,
			DueDate: f.DueDate.Format("2006-01-02"), Awaiting: f.Awaiting,
		})
	}
	snap.Forecast.Total = round2(snap.Forecast.Total)
	snap.Received.Total = round2(snap.Received.Total)
	snap.Overdue.Total = round2(snap.Overdue.Total)
	sort.SliceStable(snap.Pending, func(i, j int) bool { return snap.Pending[i].DueDate < snap.Pending[j].DueDate })
	return snap, nil
}

// Get devolve o estado do mês: fechado com o retrato gravado, ou aberto com o retrato calculado agora.
func (s *Service) Get(ctx context.Context, orgID uuid.UUID, month string) (*Closing, error) {
	if _, _, err := s.monthRange(month); err != nil {
		return nil, err
	}
	events, err := s.repo.Events(ctx, orgID, month)
	if err != nil {
		return nil, fmt.Errorf("closing.svc: histórico: %w", err)
	}
	if events == nil {
		events = []Event{}
	}
	c, err := s.repo.GetActive(ctx, orgID, month)
	if err == nil {
		c.Status = StatusClosed
		c.Events = events
		return c, nil
	}
	if !errors.Is(err, apierr.ErrNotFound) {
		return nil, fmt.Errorf("closing.svc: buscar fechamento: %w", err)
	}
	snap, err := s.snapshot(ctx, orgID, month)
	if err != nil {
		return nil, err
	}
	return &Closing{OrganizationID: orgID, Month: month, Status: StatusOpen, Snapshot: snap, Events: events}, nil
}

// Close fecha um mês já encerrado, gravando o retrato calculado agora.
func (s *Service) Close(ctx context.Context, orgID, userID uuid.UUID, month string) (*Closing, error) {
	if _, _, err := s.monthRange(month); err != nil {
		return nil, err
	}
	if month >= s.now().In(s.loc).Format("2006-01") {
		return nil, ErrMonthNotEnded
	}
	if _, err := s.repo.GetActive(ctx, orgID, month); err == nil {
		return nil, ErrAlreadyClosed
	} else if !errors.Is(err, apierr.ErrNotFound) {
		return nil, fmt.Errorf("closing.svc: buscar fechamento: %w", err)
	}
	snap, err := s.snapshot(ctx, orgID, month)
	if err != nil {
		return nil, err
	}
	name := s.names.Name(ctx, userID)
	at := s.now()
	id := uuid.New()
	c := Closing{ID: id, OrganizationID: orgID, Month: month, Status: StatusClosed, ClosedAt: &at, ClosedBy: &userID, ClosedByName: name, Snapshot: snap}
	e := Event{ID: uuid.New(), OrganizationID: orgID, Month: month, ClosingID: id, Kind: EventClosed, ActorID: &userID, ActorName: name, CreatedAt: at}
	if err := s.repo.Close(ctx, c, e); err != nil {
		return nil, err
	}
	return s.Get(ctx, orgID, month)
}

// Reopen reabre o mês fechado; o motivo é obrigatório e fica no histórico.
func (s *Service) Reopen(ctx context.Context, orgID, userID uuid.UUID, month, reason string) (*Closing, error) {
	if _, _, err := s.monthRange(month); err != nil {
		return nil, err
	}
	reason = strings.TrimSpace(reason)
	cur, err := s.repo.GetActive(ctx, orgID, month)
	if err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			return nil, ErrNotClosed
		}
		return nil, fmt.Errorf("closing.svc: buscar fechamento: %w", err)
	}
	if len([]rune(reason)) < 3 {
		return nil, ErrInvalidReason
	}
	e := Event{ID: uuid.New(), OrganizationID: orgID, Month: month, ClosingID: cur.ID, Kind: EventReopened, ActorID: &userID, ActorName: s.names.Name(ctx, userID), Reason: &reason, CreatedAt: s.now()}
	if err := s.repo.Reopen(ctx, orgID, month, e); err != nil {
		return nil, err
	}
	return s.Get(ctx, orgID, month)
}
