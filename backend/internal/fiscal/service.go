package fiscal

import (
	"context"
	"errors"
	"fmt"
	"sort"

	"github.com/google/uuid"
)

var ErrOwnerNotFound = errors.New("owner not found")

type Service struct {
	agg AggregateRepository
}

func NewService(agg AggregateRepository) *Service {
	return &Service{agg: agg}
}

func (s *Service) AnnualReport(ctx context.Context, ownerID uuid.UUID, year int) (*AnnualReport, error) {
	if year < 1900 || year > 2999 {
		return nil, fmt.Errorf("fiscal.svc: year inválido")
	}

	owner, err := s.agg.GetOwner(ctx, ownerID)
	if err != nil {
		if errors.Is(err, ErrOwnerNotFound) {
			return nil, fmt.Errorf("fiscal.svc: owner não encontrado")
		}
		return nil, fmt.Errorf("fiscal.svc: %w", err)
	}

	leases, err := s.agg.ListOwnerLeases(ctx, ownerID)
	if err != nil {
		return nil, fmt.Errorf("fiscal.svc: %w", err)
	}

	payments, err := s.agg.ListPaidPaymentsForYear(ctx, ownerID, year)
	if err != nil {
		return nil, fmt.Errorf("fiscal.svc: %w", err)
	}

	taxes, err := s.agg.ListTaxExpensesPaidInYear(ctx, ownerID, year)
	if err != nil {
		return nil, fmt.Errorf("fiscal.svc: %w", err)
	}

	report := &AnnualReport{Year: year, Owner: *owner, Leases: []AnnualLeaseReport{}}

	leaseIndex := map[uuid.UUID]*AnnualLeaseReport{}
	for _, ls := range leases {
		r := AnnualLeaseReport{
			LeaseID:          ls.LeaseID,
			Tenant:           ReportParty{Name: ls.TenantName, Document: ls.TenantDocument},
			TenantPersonType: ls.TenantPersonType,
			Unit:             ReportUnitRef{Label: ls.UnitLabel, PropertyAddress: ls.PropertyAddress},
			Category:         "CARNE_LEAO",
			MonthlyBreakdown: []MonthlyBreakdown{},
		}
		if ls.TenantPersonType == "PJ" {
			r.Category = "PJ_WITHHELD"
		}
		leaseIndex[ls.LeaseID] = &r
	}

	monthlyByLease := map[uuid.UUID]map[string]*MonthlyBreakdown{}
	for _, p := range payments {
		lr, ok := leaseIndex[p.LeaseID]
		if !ok {
			continue
		}
		if p.Type != "RENT" {
			continue
		}
		if _, ok := monthlyByLease[p.LeaseID]; !ok {
			monthlyByLease[p.LeaseID] = map[string]*MonthlyBreakdown{}
		}
		mb := monthlyByLease[p.LeaseID][p.Competency]
		if mb == nil {
			mb = &MonthlyBreakdown{Competency: p.Competency}
			monthlyByLease[p.LeaseID][p.Competency] = mb
		}
		mb.Gross += p.GrossAmount
		mb.Fees += p.LateFeeAmount + p.InterestAmount
		mb.IRRF += p.IRRFAmount
		mb.Net += p.NetAmount

		lr.TotalReceived += p.GrossAmount + p.LateFeeAmount + p.InterestAmount
		lr.TotalIRRFWithheld += p.IRRFAmount
	}

	for leaseID, months := range monthlyByLease {
		lr := leaseIndex[leaseID]
		for _, mb := range months {
			lr.MonthlyBreakdown = append(lr.MonthlyBreakdown, *mb)
		}
		sort.Slice(lr.MonthlyBreakdown, func(i, j int) bool {
			return lr.MonthlyBreakdown[i].Competency < lr.MonthlyBreakdown[j].Competency
		})
	}

	unitToLease := map[uuid.UUID]uuid.UUID{}
	for _, ls := range leases {
		unitToLease[ls.UnitID] = ls.LeaseID
	}
	for _, te := range taxes {
		if lID, ok := unitToLease[te.UnitID]; ok {
			if lr, ok := leaseIndex[lID]; ok {
				lr.DeductibleIPTUPaid += te.Amount
			}
		}
	}

	var totals AnnualTotals
	for _, lr := range leaseIndex {
		if lr.TotalReceived == 0 && lr.DeductibleIPTUPaid == 0 {
			continue
		}
		report.Leases = append(report.Leases, *lr)
		if lr.Category == "PJ_WITHHELD" {
			totals.ReceivedFromPJ += lr.TotalReceived
		} else {
			totals.ReceivedFromPF += lr.TotalReceived
		}
		totals.TotalIRRFCredit += lr.TotalIRRFWithheld
		totals.DeductibleIPTU += lr.DeductibleIPTUPaid
	}
	report.Totals = totals
	return report, nil
}