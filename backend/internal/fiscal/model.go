package fiscal

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type IRRFBracket struct {
	ID         uuid.UUID `json:"id"`
	ValidFrom  time.Time `json:"valid_from"`
	MinBase    float64   `json:"min_base"`
	MaxBase    *float64  `json:"max_base,omitempty"`
	Rate       float64   `json:"rate"`
	Deduction  float64   `json:"deduction"`
}

type BracketsRepository interface {
	ActiveBrackets(ctx context.Context, at time.Time) ([]IRRFBracket, error)
}

type IRRFTable interface {
	Calculate(ctx context.Context, base float64, at time.Time) (float64, error)
}

type AnnualReport struct {
	Year   int                 `json:"year"`
	Owner  ReportParty         `json:"owner"`
	Leases []AnnualLeaseReport `json:"leases"`
	Totals AnnualTotals        `json:"totals"`
}

type ReportParty struct {
	Name     string  `json:"name"`
	Document *string `json:"document,omitempty"`
}

type AnnualLeaseReport struct {
	LeaseID            uuid.UUID         `json:"lease_id"`
	Tenant             ReportParty       `json:"tenant"`
	TenantPersonType   string            `json:"tenant_person_type"`
	Unit               ReportUnitRef     `json:"unit"`
	TotalReceived      float64           `json:"total_received"`
	TotalIRRFWithheld  float64           `json:"total_irrf_withheld"`
	Category           string            `json:"category"`
	DeductibleIPTUPaid float64           `json:"deductible_iptu_paid"`
	MonthlyBreakdown   []MonthlyBreakdown `json:"monthly_breakdown"`
}

type ReportUnitRef struct {
	Label           *string `json:"label,omitempty"`
	PropertyAddress *string `json:"property_address,omitempty"`
}

type MonthlyBreakdown struct {
	Competency string  `json:"competency"`
	Gross      float64 `json:"gross"`
	Fees       float64 `json:"fees"`
	IRRF       float64 `json:"irrf"`
	Net        float64 `json:"net"`
}

type AnnualTotals struct {
	ReceivedFromPJ  float64 `json:"received_from_pj"`
	ReceivedFromPF  float64 `json:"received_from_pf"`
	TotalIRRFCredit float64 `json:"total_irrf_credit"`
	DeductibleIPTU  float64 `json:"deductible_iptu"`
}

type AggregateRepository interface {
	ListPaidPaymentsForYear(ctx context.Context, ownerID uuid.UUID, year int) ([]PaidPayment, error)
	ListTaxExpensesPaidInYear(ctx context.Context, ownerID uuid.UUID, year int) ([]TaxExpense, error)
	ListOwnerLeases(ctx context.Context, ownerID uuid.UUID) ([]LeaseSummary, error)
	GetOwner(ctx context.Context, ownerID uuid.UUID) (*ReportParty, error)
}

type PaidPayment struct {
	PaymentID      uuid.UUID
	LeaseID        uuid.UUID
	Competency     string
	GrossAmount    float64
	LateFeeAmount  float64
	InterestAmount float64
	IRRFAmount     float64
	NetAmount      float64
	Type           string
}

type TaxExpense struct {
	UnitID   uuid.UUID
	Amount   float64
	PaidYear int
}

type LeaseSummary struct {
	LeaseID          uuid.UUID
	TenantID         uuid.UUID
	TenantName       string
	TenantDocument   *string
	TenantPersonType string
	UnitID           uuid.UUID
	UnitLabel        *string
	PropertyAddress  *string
}
