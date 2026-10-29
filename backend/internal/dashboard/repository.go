package dashboard

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/db"
)

const (
	recentPaymentsLimit = 10
	expiringWindowDays  = 30
	dateLayout          = "2006-01-02"
)

type pgRepository struct {
	db *db.DB
}

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

// $1 = organization_id, $2 = hoje, $3 = início do mês, $4 = início do mês seguinte, $5 = fim da janela de vencimento
// (todos DATE, calculados em Go no fuso da aplicação — nunca CURRENT_DATE do banco).
// Units não têm organization_id: escopo via properties. Linhas soft-deletadas (is_active=false) ficam de fora em todo join.
const scalarsQuery = `
WITH org_units AS (
    SELECT u.id
    FROM units u
    JOIN properties p ON p.id = u.property_id
    WHERE p.organization_id = $1 AND p.is_active AND u.is_active
),
props AS (
    SELECT COUNT(*) AS c FROM properties WHERE organization_id = $1 AND is_active
),
occupied AS (
    SELECT COUNT(DISTINCT l.unit_id) AS c
    FROM leases l
    JOIN org_units ou ON ou.id = l.unit_id
    WHERE l.organization_id = $1 AND l.is_active AND l.status = 'ACTIVE'
),
tn AS (
    SELECT COUNT(*) AS c FROM tenants WHERE organization_id = $1 AND is_active
),
rev AS (
    SELECT
        COALESCE(SUM(p.gross_amount) FILTER (WHERE p.status = 'PAID'), 0) AS paid,
        COALESCE(SUM(p.gross_amount) FILTER (WHERE p.status = 'PENDING' AND p.due_date >= $2::date), 0) AS pending,
        COALESCE(SUM(p.gross_amount) FILTER (WHERE p.status = 'LATE' OR (p.status = 'PENDING' AND p.due_date < $2::date)), 0) AS overdue
    FROM payments p
    JOIN leases l ON l.id = p.lease_id AND l.organization_id = $1 AND l.is_active
    WHERE p.organization_id = $1
      AND p.due_date >= $3::date
      AND p.due_date <  $4::date
)
SELECT props.c, (SELECT COUNT(*) FROM org_units), occupied.c, tn.c,
       ROUND(rev.paid::numeric, 2)::float8,
       ROUND(rev.pending::numeric, 2)::float8,
       ROUND(rev.overdue::numeric, 2)::float8
FROM props, occupied, tn, rev`

const recentPaymentsQuery = `
SELECT p.id, COALESCE(NULLIF(p.description, ''), u.label), p.gross_amount, p.due_date, p.status, t.name
FROM payments p
JOIN leases l  ON l.id = p.lease_id AND l.is_active
JOIN units u   ON u.id = l.unit_id AND u.is_active
JOIN tenants t ON t.id = l.tenant_id AND t.is_active
WHERE p.organization_id = $1
ORDER BY p.due_date DESC, p.created_at DESC
LIMIT $2`

const expiringLeasesQuery = `
SELECT l.id, u.label, t.name, l.end_date
FROM leases l
JOIN units u   ON u.id = l.unit_id AND u.is_active
JOIN tenants t ON t.id = l.tenant_id AND t.is_active
WHERE l.organization_id = $1
  AND l.is_active AND l.status = 'ACTIVE'
  AND l.end_date BETWEEN $2::date AND $3::date
ORDER BY l.end_date ASC`

func (r *pgRepository) GetMetrics(ctx context.Context, orgID uuid.UUID, now time.Time) (*Metrics, error) {
	// Datas de calendário no fuso de now (definido pelo service), independente de UTC/CURRENT_DATE do banco.
	y, mo, d := now.Date()
	today := time.Date(y, mo, d, 0, 0, 0, 0, time.UTC)
	monthStart := time.Date(y, mo, 1, 0, 0, 0, 0, time.UTC)
	nextMonth := monthStart.AddDate(0, 1, 0)
	windowEnd := today.AddDate(0, 0, expiringWindowDays)
	m := &Metrics{RecentPayments: []RecentPayment{}, ExpiringLeases: []ExpiringLease{}}

	err := r.db.Pool.QueryRow(ctx, scalarsQuery, orgID, today, monthStart, nextMonth).Scan(
		&m.TotalProperties, &m.TotalUnits, &m.OccupiedUnits, &m.TotalTenants,
		&m.MonthlyRevenue.Paid, &m.MonthlyRevenue.Pending, &m.MonthlyRevenue.Overdue,
	)
	if err != nil {
		return nil, fmt.Errorf("dashboard.repo: scalars: %w", err)
	}
	m.MonthlyRevenue.Total = math.Round((m.MonthlyRevenue.Paid+m.MonthlyRevenue.Pending+m.MonthlyRevenue.Overdue)*100) / 100
	m.VacancyRate = VacancyRate(m.TotalUnits, m.OccupiedUnits)

	rows, err := r.db.Pool.Query(ctx, recentPaymentsQuery, orgID, recentPaymentsLimit)
	if err != nil {
		return nil, fmt.Errorf("dashboard.repo: recent payments: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var p RecentPayment
		var due time.Time
		if err := rows.Scan(&p.ID, &p.Description, &p.Amount, &due, &p.Status, &p.TenantName); err != nil {
			return nil, fmt.Errorf("dashboard.repo: recent payments scan: %w", err)
		}
		p.DueDate = due.Format(dateLayout)
		m.RecentPayments = append(m.RecentPayments, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("dashboard.repo: recent payments rows: %w", err)
	}

	lrows, err := r.db.Pool.Query(ctx, expiringLeasesQuery, orgID, today, windowEnd)
	if err != nil {
		return nil, fmt.Errorf("dashboard.repo: expiring leases: %w", err)
	}
	defer lrows.Close()
	for lrows.Next() {
		var l ExpiringLease
		var end time.Time
		if err := lrows.Scan(&l.ID, &l.UnitLabel, &l.TenantName, &end); err != nil {
			return nil, fmt.Errorf("dashboard.repo: expiring leases scan: %w", err)
		}
		l.EndDate = end.Format(dateLayout)
		m.ExpiringLeases = append(m.ExpiringLeases, l)
	}
	if err := lrows.Err(); err != nil {
		return nil, fmt.Errorf("dashboard.repo: expiring leases rows: %w", err)
	}
	return m, nil
}
