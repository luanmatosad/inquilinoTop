package dashboard

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type MonthlyRevenue struct {
	Total   float64 `json:"total"`
	Paid    float64 `json:"paid"`
	Pending float64 `json:"pending"`
	Overdue float64 `json:"overdue"`
}

type RecentPayment struct {
	ID          uuid.UUID `json:"id"`
	Description string    `json:"description"`
	Amount      float64   `json:"amount"`
	DueDate     string    `json:"due_date"` // YYYY-MM-DD
	Status      string    `json:"status"`
	TenantName  string    `json:"tenant_name"`
}

type ExpiringLease struct {
	ID         uuid.UUID `json:"id"`
	UnitLabel  string    `json:"unit_label"`
	TenantName string    `json:"tenant_name"`
	EndDate    string    `json:"end_date"` // YYYY-MM-DD
}

type Metrics struct {
	TotalProperties int             `json:"total_properties"`
	TotalUnits      int             `json:"total_units"`
	OccupiedUnits   int             `json:"occupied_units"`
	VacancyRate     float64         `json:"vacancy_rate"` // percent, 0-100
	TotalTenants    int             `json:"total_tenants"`
	MonthlyRevenue  MonthlyRevenue  `json:"monthly_revenue"`
	RecentPayments  []RecentPayment `json:"recent_payments"`
	ExpiringLeases  []ExpiringLease `json:"expiring_leases"`
}

type Repository interface {
	// GetMetrics agrega as métricas da organização; now define o mês corrente e a janela de vencimento.
	GetMetrics(ctx context.Context, orgID uuid.UUID, now time.Time) (*Metrics, error)
}
