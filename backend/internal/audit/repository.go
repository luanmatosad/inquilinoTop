package audit

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type pgRepository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *pgRepository {
	return &pgRepository{pool: pool}
}

func (r *pgRepository) Create(ctx context.Context, ownerID uuid.UUID, in CreateInput) (*AuditLog, error) {
	detailsJSON, _ := json.Marshal(in.Details)

	log := &AuditLog{
		ID:         uuid.New(),
		OwnerID:    ownerID,
		UserID:     in.UserID,
		EventType:  in.EventType,
		EntityType: in.EntityType,
		EntityID:   in.EntityID,
		IPAddress:  in.IPAddress,
		UserAgent:  in.UserAgent,
		Details:    in.Details,
		CreatedAt:  time.Now().UTC(),
	}

	_, err := r.pool.Exec(ctx, `
		INSERT INTO audit_logs (id, owner_id, user_id, event_type, entity_type, entity_id, ip_address, user_agent, details, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`,
		log.ID, log.OwnerID, log.UserID, log.EventType, log.EntityType, log.EntityID,
		log.IPAddress, log.UserAgent, detailsJSON, log.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	return log, nil
}

func (r *pgRepository) List(ctx context.Context, ownerID uuid.UUID, from, to *time.Time, eventType *string) ([]AuditLog, error) {
	query := `
		SELECT id, owner_id, user_id, event_type, entity_type, entity_id, ip_address, user_agent, details, created_at
		FROM audit_logs
		WHERE owner_id = $1
	`
	args := []interface{}{ownerID}
	argIdx := 2

	if from != nil {
		query += ` AND created_at >= $` + string(rune('0'+argIdx))
		args = append(args, *from)
		argIdx++
	}
	if to != nil {
		query += ` AND created_at <= $` + string(rune('0'+argIdx))
		args = append(args, *to)
		argIdx++
	}
	if eventType != nil {
		query += ` AND event_type = $` + string(rune('0'+argIdx))
		args = append(args, *eventType)
		argIdx++
	}

	query += ` ORDER BY created_at DESC LIMIT 100`

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []AuditLog
	for rows.Next() {
		var log AuditLog
		var detailsJSON []byte
		err := rows.Scan(
			&log.ID, &log.OwnerID, &log.UserID, &log.EventType, &log.EntityType, &log.EntityID,
			&log.IPAddress, &log.UserAgent, &detailsJSON, &log.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		if len(detailsJSON) > 0 {
			json.Unmarshal(detailsJSON, &log.Details)
		}
		logs = append(logs, log)
	}

	return logs, nil
}