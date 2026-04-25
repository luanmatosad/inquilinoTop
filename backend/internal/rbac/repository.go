package rbac

import (
	"context"
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

func (r *pgRepository) Create(ctx context.Context, in CreateInput) (*UserRole, error) {
	role := &UserRole{
		ID:          uuid.New(),
		UserID:     in.UserID,
		Role:       in.Role,
		PropertyID: in.PropertyID,
		CreatedAt:  time.Now().UTC(),
	}

	_, err := r.pool.Exec(ctx, `
		INSERT INTO user_roles (id, user_id, role, property_id, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`,
		role.ID, role.UserID, role.Role, role.PropertyID, role.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	return role, nil
}

func (r *pgRepository) Delete(ctx context.Context, userID uuid.UUID, role RoleType, propertyID *uuid.UUID) error {
	if propertyID != nil {
		_, err := r.pool.Exec(ctx, `
			DELETE FROM user_roles
			WHERE user_id = $1 AND role = $2 AND property_id = $3
		`, userID, role, propertyID)
		return err
	}

	_, err := r.pool.Exec(ctx, `
		DELETE FROM user_roles
		WHERE user_id = $1 AND role = $2 AND property_id IS NULL
	`, userID, role)
	return err
}

func (r *pgRepository) GetByUser(ctx context.Context, userID uuid.UUID) ([]UserRole, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, role, property_id, created_at
		FROM user_roles
		WHERE user_id = $1
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roles []UserRole
	for rows.Next() {
		var role UserRole
		err := rows.Scan(&role.ID, &role.UserID, &role.Role, &role.PropertyID, &role.CreatedAt)
		if err != nil {
			return nil, err
		}
		roles = append(roles, role)
	}

	return roles, nil
}

func (r *pgRepository) GetByUserAndProperty(ctx context.Context, userID, propertyID uuid.UUID) ([]UserRole, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, role, property_id, created_at
		FROM user_roles
		WHERE user_id = $1 AND property_id = $2
	`, userID, propertyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roles []UserRole
	for rows.Next() {
		var role UserRole
		err := rows.Scan(&role.ID, &role.UserID, &role.Role, &role.PropertyID, &role.CreatedAt)
		if err != nil {
			return nil, err
		}
		roles = append(roles, role)
	}

	return roles, nil
}

func (r *pgRepository) HasRole(ctx context.Context, userID uuid.UUID, role RoleType, propertyID *uuid.UUID) (bool, error) {
	var exists bool

	if propertyID != nil {
		err := r.pool.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1 FROM user_roles
				WHERE user_id = $1 AND role = $2 AND property_id = $3
			)
		`, userID, role, propertyID).Scan(&exists)
		return exists, err
	}

	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM user_roles
			WHERE user_id = $1 AND role = $2
		)
	`, userID, role).Scan(&exists)
	return exists, err
}