package organization

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/jackc/pgx/v5"
)

type repository struct {
	db *db.DB
}

func NewRepository(db *db.DB) Repository {
	return &repository{db: db}
}

func (r *repository) GetByID(ctx context.Context, id uuid.UUID) (*Organization, error) {
	var org Organization
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, name, plan, created_at, updated_at
		FROM organizations WHERE id = $1
	`, id).Scan(&org.ID, &org.Name, &org.Plan, &org.CreatedAt, &org.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get org: %w", err)
	}
	return &org, nil
}

func (r *repository) GetByUserID(ctx context.Context, userID uuid.UUID) (*Organization, error) {
	var org Organization
	err := r.db.Pool.QueryRow(ctx, `
		SELECT o.id, o.name, o.plan, o.created_at, o.updated_at
		FROM organizations o
		JOIN organization_members m ON m.organization_id = o.id
		WHERE m.user_id = $1
		ORDER BY m.created_at ASC
		LIMIT 1
	`, userID).Scan(&org.ID, &org.Name, &org.Plan, &org.CreatedAt, &org.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get org by user: %w", err)
	}
	return &org, nil
}

func (r *repository) Update(ctx context.Context, id uuid.UUID, in UpdateOrgInput) (*Organization, error) {
	var org Organization
	err := r.db.Pool.QueryRow(ctx, `
		UPDATE organizations SET name = $2, updated_at = NOW()
		WHERE id = $1
		RETURNING id, name, plan, created_at, updated_at
	`, id, in.Name).Scan(&org.ID, &org.Name, &org.Plan, &org.CreatedAt, &org.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("update org: %w", err)
	}
	return &org, nil
}

func (r *repository) Create(ctx context.Context, name string) (*Organization, error) {
	var org Organization
	err := r.db.Pool.QueryRow(ctx, `
		INSERT INTO organizations (name) VALUES ($1)
		RETURNING id, name, plan, created_at, updated_at
	`, name).Scan(&org.ID, &org.Name, &org.Plan, &org.CreatedAt, &org.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create org: %w", err)
	}
	return &org, nil
}

func (r *repository) CreateBranch(ctx context.Context, orgID uuid.UUID, in CreateBranchInput) (*Branch, error) {
	var branch Branch
	err := r.db.Pool.QueryRow(ctx, `
		INSERT INTO branches (organization_id, name, region)
		VALUES ($1, $2, $3)
		RETURNING id, organization_id, name, region, is_active, created_at, updated_at
	`, orgID, in.Name, in.Region).Scan(&branch.ID, &branch.OrganizationID, &branch.Name, &branch.Region, &branch.IsActive, &branch.CreatedAt, &branch.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create branch: %w", err)
	}
	return &branch, nil
}

func (r *repository) GetBranch(ctx context.Context, id, orgID uuid.UUID) (*Branch, error) {
	var branch Branch
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, organization_id, name, region, is_active, created_at, updated_at
		FROM branches WHERE id = $1 AND organization_id = $2
	`, id, orgID).Scan(&branch.ID, &branch.OrganizationID, &branch.Name, &branch.Region, &branch.IsActive, &branch.CreatedAt, &branch.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get branch: %w", err)
	}
	return &branch, nil
}

func (r *repository) ListBranches(ctx context.Context, orgID uuid.UUID) ([]Branch, error) {
	rows, err := r.db.Pool.Query(ctx, `
		SELECT id, organization_id, name, region, is_active, created_at, updated_at
		FROM branches WHERE organization_id = $1
		ORDER BY name ASC
	`, orgID)
	if err != nil {
		return nil, fmt.Errorf("list branches: %w", err)
	}
	defer rows.Close()

	var branches []Branch
	for rows.Next() {
		var b Branch
		if err := rows.Scan(&b.ID, &b.OrganizationID, &b.Name, &b.Region, &b.IsActive, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan branch: %w", err)
		}
		branches = append(branches, b)
	}
	return branches, nil
}

func (r *repository) UpdateBranch(ctx context.Context, id, orgID uuid.UUID, in UpdateBranchInput) (*Branch, error) {
	var branch Branch
	err := r.db.Pool.QueryRow(ctx, `
		UPDATE branches
		SET name = COALESCE(NULLIF($3, ''), name),
		    region = COALESCE($4, region),
		    is_active = COALESCE($5, is_active),
		    updated_at = NOW()
		WHERE id = $1 AND organization_id = $2
		RETURNING id, organization_id, name, region, is_active, created_at, updated_at
	`, id, orgID, in.Name, in.Region, in.IsActive).Scan(&branch.ID, &branch.OrganizationID, &branch.Name, &branch.Region, &branch.IsActive, &branch.CreatedAt, &branch.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("update branch: %w", err)
	}
	return &branch, nil
}

func (r *repository) DeleteBranch(ctx context.Context, id, orgID uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `
		DELETE FROM branches WHERE id = $1 AND organization_id = $2
	`, id, orgID)
	if err != nil {
		return fmt.Errorf("delete branch: %w", err)
	}
	return nil
}

func (r *repository) GetMembership(ctx context.Context, userID, orgID uuid.UUID) (*Member, error) {
	var m Member
	err := r.db.Pool.QueryRow(ctx, `
		SELECT m.id, m.organization_id, m.user_id, m.role, m.branch_id, m.created_at, m.updated_at,
		       u.email, up.full_name, b.name
		FROM organization_members m
		JOIN users u ON u.id = m.user_id
		LEFT JOIN user_profiles up ON up.user_id = u.id
		LEFT JOIN branches b ON b.id = m.branch_id
		WHERE m.user_id = $1 AND m.organization_id = $2
	`, userID, orgID).Scan(&m.ID, &m.OrganizationID, &m.UserID, &m.Role, &m.BranchID, &m.CreatedAt, &m.UpdatedAt,
		&m.UserEmail, &m.UserFullName, &m.BranchName)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get membership: %w", err)
	}
	return &m, nil
}

func (r *repository) GetMembershipByID(ctx context.Context, memberID uuid.UUID) (*Member, error) {
	var m Member
	err := r.db.Pool.QueryRow(ctx, `
		SELECT m.id, m.organization_id, m.user_id, m.role, m.branch_id, m.created_at, m.updated_at,
		       u.email, up.full_name, b.name
		FROM organization_members m
		JOIN users u ON u.id = m.user_id
		LEFT JOIN user_profiles up ON up.user_id = u.id
		LEFT JOIN branches b ON b.id = m.branch_id
		WHERE m.id = $1
	`, memberID).Scan(&m.ID, &m.OrganizationID, &m.UserID, &m.Role, &m.BranchID, &m.CreatedAt, &m.UpdatedAt,
		&m.UserEmail, &m.UserFullName, &m.BranchName)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get membership by id: %w", err)
	}
	return &m, nil
}

func (r *repository) ListMembers(ctx context.Context, orgID uuid.UUID) ([]Member, error) {
	rows, err := r.db.Pool.Query(ctx, `
		SELECT m.id, m.organization_id, m.user_id, m.role, m.branch_id, m.created_at, m.updated_at,
		       u.email, up.full_name, b.name
		FROM organization_members m
		JOIN users u ON u.id = m.user_id
		LEFT JOIN user_profiles up ON up.user_id = u.id
		LEFT JOIN branches b ON b.id = m.branch_id
		WHERE m.organization_id = $1
		ORDER BY m.role, u.email
	`, orgID)
	if err != nil {
		return nil, fmt.Errorf("list members: %w", err)
	}
	defer rows.Close()

	var members []Member
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.ID, &m.OrganizationID, &m.UserID, &m.Role, &m.BranchID, &m.CreatedAt, &m.UpdatedAt,
			&m.UserEmail, &m.UserFullName, &m.BranchName); err != nil {
			return nil, fmt.Errorf("scan member: %w", err)
		}
		members = append(members, m)
	}
	return members, nil
}

func (r *repository) UpdateMemberRole(ctx context.Context, memberID uuid.UUID, role RoleType) error {
	_, err := r.db.Pool.Exec(ctx, `
		UPDATE organization_members SET role = $2, updated_at = NOW()
		WHERE id = $1
	`, memberID, role)
	if err != nil {
		return fmt.Errorf("update member role: %w", err)
	}
	return nil
}

func (r *repository) RemoveMember(ctx context.Context, memberID, orgID uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `
		DELETE FROM organization_members WHERE id = $1 AND organization_id = $2
	`, memberID, orgID)
	if err != nil {
		return fmt.Errorf("remove member: %w", err)
	}
	return nil
}

func (r *repository) CreateMember(ctx context.Context, orgID, userID uuid.UUID, role RoleType, branchID *uuid.UUID) (*Member, error) {
	var m Member
	err := r.db.Pool.QueryRow(ctx, `
		INSERT INTO organization_members (organization_id, user_id, role, branch_id)
		VALUES ($1, $2, $3, $4)
		RETURNING id, organization_id, user_id, role, branch_id, created_at, updated_at
	`, orgID, userID, role, branchID).Scan(&m.ID, &m.OrganizationID, &m.UserID, &m.Role, &m.BranchID, &m.CreatedAt, &m.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create member: %w", err)
	}
	return &m, nil
}

func (r *repository) HasRole(ctx context.Context, userID, orgID uuid.UUID, role RoleType) (bool, error) {
	var exists bool
	err := r.db.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM organization_members
			WHERE user_id = $1 AND organization_id = $2 AND role = $3
		)
	`, userID, orgID, role).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("has role: %w", err)
	}
	return exists, nil
}

func (r *repository) CreateInvite(ctx context.Context, in CreateInviteInput, orgID, invitedBy uuid.UUID, token string, expiresAt time.Time) (*Invite, error) {
	var inv Invite
	err := r.db.Pool.QueryRow(ctx, `
		INSERT INTO organization_invites (organization_id, email, role, branch_id, token, invited_by, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, organization_id, email, role, branch_id, invited_by, expires_at, accepted_at, created_at
	`, orgID, in.Email, in.Role, in.BranchID, token, invitedBy, expiresAt).Scan(&inv.ID, &inv.OrganizationID, &inv.Email, &inv.Role, &inv.BranchID, &inv.InvitedBy, &inv.ExpiresAt, &inv.AcceptedAt, &inv.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create invite: %w", err)
	}
	return &inv, nil
}

func (r *repository) GetInviteByToken(ctx context.Context, token string) (*Invite, error) {
	var inv Invite
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, organization_id, email, role, branch_id, invited_by, expires_at, accepted_at, created_at
		FROM organization_invites WHERE token = $1
	`, token).Scan(&inv.ID, &inv.OrganizationID, &inv.Email, &inv.Role, &inv.BranchID, &inv.InvitedBy, &inv.ExpiresAt, &inv.AcceptedAt, &inv.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get invite by token: %w", err)
	}
	return &inv, nil
}

func (r *repository) GetInviteByEmail(ctx context.Context, email string, orgID uuid.UUID) (*Invite, error) {
	var inv Invite
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, organization_id, email, role, branch_id, invited_by, expires_at, accepted_at, created_at
		FROM organization_invites
		WHERE email = $1 AND organization_id = $2 AND accepted_at IS NULL AND expires_at > NOW()
	`, email, orgID).Scan(&inv.ID, &inv.OrganizationID, &inv.Email, &inv.Role, &inv.BranchID, &inv.InvitedBy, &inv.ExpiresAt, &inv.AcceptedAt, &inv.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get invite by email: %w", err)
	}
	return &inv, nil
}

func (r *repository) ListInvites(ctx context.Context, orgID uuid.UUID) ([]Invite, error) {
	rows, err := r.db.Pool.Query(ctx, `
		SELECT id, organization_id, email, role, branch_id, invited_by, expires_at, accepted_at, created_at
		FROM organization_invites WHERE organization_id = $1 AND accepted_at IS NULL
		ORDER BY created_at DESC
	`, orgID)
	if err != nil {
		return nil, fmt.Errorf("list invites: %w", err)
	}
	defer rows.Close()

	var invites []Invite
	for rows.Next() {
		var inv Invite
		if err := rows.Scan(&inv.ID, &inv.OrganizationID, &inv.Email, &inv.Role, &inv.BranchID, &inv.InvitedBy, &inv.ExpiresAt, &inv.AcceptedAt, &inv.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan invite: %w", err)
		}
		invites = append(invites, inv)
	}
	return invites, nil
}

func (r *repository) CancelInvite(ctx context.Context, inviteID, orgID uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `
		DELETE FROM organization_invites WHERE id = $1 AND organization_id = $2
	`, inviteID, orgID)
	if err != nil {
		return fmt.Errorf("cancel invite: %w", err)
	}
	return nil
}

func (r *repository) AcceptInvite(ctx context.Context, inviteID uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `
		UPDATE organization_invites SET accepted_at = NOW() WHERE id = $1
	`, inviteID)
	if err != nil {
		return fmt.Errorf("accept invite: %w", err)
	}
	return nil
}

func (r *repository) GetMembershipByUserID(ctx context.Context, userID uuid.UUID) (*Member, error) {
	var m Member
	err := r.db.Pool.QueryRow(ctx, `
		SELECT m.id, m.organization_id, m.user_id, m.role, m.branch_id, m.created_at, m.updated_at,
		       u.email, up.full_name, b.name
		FROM organization_members m
		JOIN users u ON u.id = m.user_id
		LEFT JOIN user_profiles up ON up.user_id = u.id
		LEFT JOIN branches b ON b.id = m.branch_id
		WHERE m.user_id = $1
		ORDER BY m.created_at ASC
		LIMIT 1
	`, userID).Scan(&m.ID, &m.OrganizationID, &m.UserID, &m.Role, &m.BranchID, &m.CreatedAt, &m.UpdatedAt,
		&m.UserEmail, &m.UserFullName, &m.BranchName)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get membership by user id: %w", err)
	}
	return &m, nil
}

var _ Repository = (*repository)(nil)