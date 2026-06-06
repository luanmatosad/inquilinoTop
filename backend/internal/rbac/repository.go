package rbac

import (
	"context"
	"errors"
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
		ID:             uuid.New(),
		UserID:         in.UserID,
		Role:           in.Role,
		OrganizationID:  in.OrganizationID,
		BranchID:       in.BranchID,
		CreatedAt:      time.Now().UTC(),
	}

	_, err := r.pool.Exec(ctx, `
		INSERT INTO user_roles (id, user_id, role, organization_id, branch_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`,
		role.ID, role.UserID, role.Role, role.OrganizationID, role.BranchID, role.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	return role, nil
}

func (r *pgRepository) Delete(ctx context.Context, userID uuid.UUID, role RoleType, orgID, branchID *uuid.UUID) error {
	if orgID != nil && branchID != nil {
		_, err := r.pool.Exec(ctx, `
			DELETE FROM user_roles
			WHERE user_id = $1 AND role = $2 AND organization_id = $3 AND branch_id = $4
		`, userID, role, orgID, branchID)
		return err
	}

	if orgID != nil {
		_, err := r.pool.Exec(ctx, `
			DELETE FROM user_roles
			WHERE user_id = $1 AND role = $2 AND organization_id = $3
		`, userID, role, orgID)
		return err
	}

	_, err := r.pool.Exec(ctx, `
		DELETE FROM user_roles
		WHERE user_id = $1 AND role = $2
	`, userID, role)
	return err
}

func (r *pgRepository) GetByUser(ctx context.Context, userID uuid.UUID) ([]UserRole, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, role, organization_id, branch_id, created_at
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
		err := rows.Scan(&role.ID, &role.UserID, &role.Role, &role.OrganizationID, &role.BranchID, &role.CreatedAt)
		if err != nil {
			return nil, err
		}
		roles = append(roles, role)
	}

	return roles, nil
}

func (r *pgRepository) GetByUserAndOrg(ctx context.Context, userID, orgID uuid.UUID) ([]UserRole, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, role, organization_id, branch_id, created_at
		FROM user_roles
		WHERE user_id = $1 AND organization_id = $2
	`, userID, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var roles []UserRole
	for rows.Next() {
		var role UserRole
		err := rows.Scan(&role.ID, &role.UserID, &role.Role, &role.OrganizationID, &role.BranchID, &role.CreatedAt)
		if err != nil {
			return nil, err
		}
		roles = append(roles, role)
	}

	return roles, nil
}

func (r *pgRepository) HasRole(ctx context.Context, userID uuid.UUID, role RoleType, orgID, branchID *uuid.UUID) (bool, error) {
	var exists bool

	if orgID != nil && branchID != nil {
		err := r.pool.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1 FROM user_roles
				WHERE user_id = $1 AND role = $2 AND organization_id = $3 AND branch_id = $4
			)
		`, userID, role, orgID, branchID).Scan(&exists)
		return exists, err
	}

	if orgID != nil {
		err := r.pool.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1 FROM user_roles
				WHERE user_id = $1 AND role = $2 AND organization_id = $3
			)
		`, userID, role, orgID).Scan(&exists)
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

func (r *pgRepository) HasAnyRole(ctx context.Context, userID, orgID uuid.UUID) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM user_roles
			WHERE user_id = $1 AND organization_id = $2
		)
	`, userID, orgID).Scan(&exists)
	return exists, err
}

var _ Repository = (*pgRepository)(nil)

func IsErrRoleAlreadyExists(err error) bool {
	return errors.Is(err, ErrRoleAlreadyExists)
}

func IsErrRoleNotFound(err error) bool {
	return errors.Is(err, ErrRoleNotFound)
}