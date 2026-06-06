package organization_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/organization"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockRepo struct {
	orgs      map[uuid.UUID]*organization.Organization
	members   map[uuid.UUID]*organization.Member
	invites   map[uuid.UUID]*organization.Invite
	branches  map[uuid.UUID]*organization.Branch
}

func newMockRepo() *mockRepo {
	return &mockRepo{
		orgs:     make(map[uuid.UUID]*organization.Organization),
		members:  make(map[uuid.UUID]*organization.Member),
		invites:  make(map[uuid.UUID]*organization.Invite),
		branches: make(map[uuid.UUID]*organization.Branch),
	}
}

func (m *mockRepo) GetByID(ctx context.Context, id uuid.UUID) (*organization.Organization, error) {
	if org, ok := m.orgs[id]; ok {
		return org, nil
	}
	return nil, nil
}

func (m *mockRepo) GetByUserID(ctx context.Context, userID uuid.UUID) (*organization.Organization, error) {
	for _, member := range m.members {
		if member.UserID == userID {
			return m.orgs[member.OrganizationID], nil
		}
	}
	return nil, nil
}

func (m *mockRepo) Update(ctx context.Context, id uuid.UUID, in organization.UpdateOrgInput) (*organization.Organization, error) {
	if org, ok := m.orgs[id]; ok {
		org.Name = in.Name
		return org, nil
	}
	return nil, nil
}

func (m *mockRepo) Create(ctx context.Context, name string) (*organization.Organization, error) {
	return nil, nil
}

func (m *mockRepo) CreateBranch(ctx context.Context, orgID uuid.UUID, in organization.CreateBranchInput) (*organization.Branch, error) {
	return nil, nil
}

func (m *mockRepo) GetBranch(ctx context.Context, id, orgID uuid.UUID) (*organization.Branch, error) {
	if branch, ok := m.branches[id]; ok && branch.OrganizationID == orgID {
		return branch, nil
	}
	return nil, nil
}

func (m *mockRepo) ListBranches(ctx context.Context, orgID uuid.UUID) ([]organization.Branch, error) {
	return nil, nil
}

func (m *mockRepo) UpdateBranch(ctx context.Context, id, orgID uuid.UUID, in organization.UpdateBranchInput) (*organization.Branch, error) {
	return nil, nil
}

func (m *mockRepo) DeleteBranch(ctx context.Context, id, orgID uuid.UUID) error {
	return nil
}

func (m *mockRepo) GetMembership(ctx context.Context, userID, orgID uuid.UUID) (*organization.Member, error) {
	for _, member := range m.members {
		if member.UserID == userID && member.OrganizationID == orgID {
			return member, nil
		}
	}
	return nil, nil
}

func (m *mockRepo) GetMembershipByID(ctx context.Context, memberID uuid.UUID) (*organization.Member, error) {
	if member, ok := m.members[memberID]; ok {
		return member, nil
	}
	return nil, nil
}

func (m *mockRepo) ListMembers(ctx context.Context, orgID uuid.UUID) ([]organization.Member, error) {
	var list []organization.Member
	for _, member := range m.members {
		if member.OrganizationID == orgID {
			list = append(list, *member)
		}
	}
	return list, nil
}

func (m *mockRepo) UpdateMemberRole(ctx context.Context, memberID uuid.UUID, role organization.RoleType) error {
	if member, ok := m.members[memberID]; ok {
		member.Role = role
	}
	return nil
}

func (m *mockRepo) RemoveMember(ctx context.Context, memberID, orgID uuid.UUID) error {
	if member, ok := m.members[memberID]; ok && member.OrganizationID == orgID {
		delete(m.members, memberID)
	}
	return nil
}

func (m *mockRepo) CreateMember(ctx context.Context, orgID, userID uuid.UUID, role organization.RoleType, branchID *uuid.UUID) (*organization.Member, error) {
	return nil, nil
}

func (m *mockRepo) HasRole(ctx context.Context, userID, orgID uuid.UUID, role organization.RoleType) (bool, error) {
	return true, nil
}

func (m *mockRepo) CreateInvite(ctx context.Context, in organization.CreateInviteInput, orgID, invitedBy uuid.UUID, token string, expiresAt time.Time) (*organization.Invite, error) {
	invite := &organization.Invite{
		ID:             uuid.New(),
		OrganizationID: orgID,
		Email:          in.Email,
		Role:           in.Role,
		BranchID:       in.BranchID,
		Token:          token,
		InvitedBy:      invitedBy,
		ExpiresAt:      expiresAt,
		CreatedAt:      time.Now(),
	}
	m.invites[invite.ID] = invite
	return invite, nil
}

func (m *mockRepo) GetInviteByToken(ctx context.Context, token string) (*organization.Invite, error) {
	for _, invite := range m.invites {
		if invite.Token == token {
			return invite, nil
		}
	}
	return nil, nil
}

func (m *mockRepo) ListInvites(ctx context.Context, orgID uuid.UUID) ([]organization.Invite, error) {
	var list []organization.Invite
	for _, invite := range m.invites {
		if invite.OrganizationID == orgID {
			list = append(list, *invite)
		}
	}
	return list, nil
}

func (m *mockRepo) CancelInvite(ctx context.Context, inviteID, orgID uuid.UUID) error {
	if invite, ok := m.invites[inviteID]; ok && invite.OrganizationID == orgID {
		delete(m.invites, inviteID)
	}
	return nil
}

func (m *mockRepo) AcceptInvite(ctx context.Context, inviteID uuid.UUID) error {
	if invite, ok := m.invites[inviteID]; ok {
		now := time.Now()
		invite.AcceptedAt = &now
	}
	return nil
}

func (m *mockRepo) GetInviteByEmail(ctx context.Context, email string, orgID uuid.UUID) (*organization.Invite, error) {
	return nil, nil
}

func (m *mockRepo) GetMembershipByUserID(ctx context.Context, userID uuid.UUID) (*organization.Member, error) {
	for _, member := range m.members {
		if member.UserID == userID {
			return member, nil
		}
	}
	return nil, nil
}

func setupTestContext(userID, orgID uuid.UUID, role string) context.Context {
	return auth.WithOwnerIDOrgIDRole(context.Background(), userID, orgID, role)
}

func TestService_GetOrganization(t *testing.T) {
	repo := newMockRepo()
	svc := organization.NewService(repo)

	userID := uuid.New()
	orgID := uuid.New()
	
	repo.orgs[orgID] = &organization.Organization{
		ID:   orgID,
		Name: "Test Org",
	}

	ctx := setupTestContext(userID, orgID, "owner")
	
	org, err := svc.GetOrganization(ctx)
	require.NoError(t, err)
	require.NotNil(t, org)
	assert.Equal(t, "Test Org", org.Name)
}

func TestService_UpdateOrganization(t *testing.T) {
	repo := newMockRepo()
	svc := organization.NewService(repo)

	userID := uuid.New()
	orgID := uuid.New()
	
	repo.orgs[orgID] = &organization.Organization{
		ID:   orgID,
		Name: "Test Org",
	}

	ctx := setupTestContext(userID, orgID, "owner")
	
	org, err := svc.UpdateOrganization(ctx, organization.UpdateOrgInput{Name: "Updated Org"})
	require.NoError(t, err)
	require.NotNil(t, org)
	assert.Equal(t, "Updated Org", org.Name)
}

func TestService_ListMembers(t *testing.T) {
	repo := newMockRepo()
	svc := organization.NewService(repo)

	userID := uuid.New()
	orgID := uuid.New()

	repo.members[uuid.New()] = &organization.Member{
		ID:             uuid.New(),
		OrganizationID: orgID,
		UserID:         userID,
		Role:           organization.RoleOwner,
	}

	repo.members[uuid.New()] = &organization.Member{
		ID:             uuid.New(),
		OrganizationID: orgID,
		UserID:         uuid.New(),
		Role:           organization.RoleAdmin,
	}

	ctx := setupTestContext(userID, orgID, "owner")
	
	members, err := svc.ListMembers(ctx)
	require.NoError(t, err)
	assert.Len(t, members, 2)
}

func TestService_UpdateMemberRole_CannotChangeOwner(t *testing.T) {
	repo := newMockRepo()
	svc := organization.NewService(repo)

	userID := uuid.New()
	orgID := uuid.New()
	memberID := uuid.New()

	repo.members[memberID] = &organization.Member{
		ID:             memberID,
		OrganizationID: orgID,
		UserID:         uuid.New(),
		Role:           organization.RoleOwner,
	}

	ctx := setupTestContext(userID, orgID, "owner")
	
	_, err := svc.UpdateMemberRole(ctx, memberID, organization.UpdateMemberRoleInput{Role: organization.RoleAdmin})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "cannot change owner role")
}

func TestService_RemoveMember_CannotRemoveOwner(t *testing.T) {
	repo := newMockRepo()
	svc := organization.NewService(repo)

	userID := uuid.New()
	orgID := uuid.New()
	memberID := uuid.New()

	repo.members[memberID] = &organization.Member{
		ID:             memberID,
		OrganizationID: orgID,
		UserID:         uuid.New(),
		Role:           organization.RoleOwner,
	}

	ctx := setupTestContext(userID, orgID, "owner")
	
	err := svc.RemoveMember(ctx, memberID)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "cannot remove owner")
}

func TestService_RemoveMember_CannotRemoveSelf(t *testing.T) {
	repo := newMockRepo()
	svc := organization.NewService(repo)

	userID := uuid.New()
	orgID := uuid.New()
	memberID := uuid.New()

	repo.members[memberID] = &organization.Member{
		ID:             memberID,
		OrganizationID: orgID,
		UserID:         userID,
		Role:           organization.RoleAdmin,
	}

	ctx := setupTestContext(userID, orgID, "admin")
	
	err := svc.RemoveMember(ctx, memberID)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "cannot remove yourself")
}

func TestService_CreateInvite_GeneratesToken(t *testing.T) {
	repo := newMockRepo()
	svc := organization.NewService(repo)

	userID := uuid.New()
	orgID := uuid.New()

	ctx := setupTestContext(userID, orgID, "owner")
	
	invite, err := svc.CreateInvite(ctx, organization.CreateInviteInput{
		Email: "test@example.com",
		Role:  organization.RoleAdmin,
	})
	
	require.NoError(t, err)
	require.NotNil(t, invite)
	assert.NotEmpty(t, invite.Token)
	assert.Equal(t, "test@example.com", invite.Email)
	assert.Equal(t, organization.RoleAdmin, invite.Role)
}

func TestService_AcceptInvite_AlreadyAccepted(t *testing.T) {
	repo := newMockRepo()
	svc := organization.NewService(repo)

	userID := uuid.New()
	orgID := uuid.New()
	token := "valid_token"

	now := time.Now()
	repo.invites[uuid.New()] = &organization.Invite{
		ID:             uuid.New(),
		OrganizationID: orgID,
		Email:          "test@example.com",
		Token:          token,
		AcceptedAt:     &now,
		ExpiresAt:      time.Now().Add(24 * time.Hour),
	}

	ctx := setupTestContext(userID, orgID, "viewer")
	
	err := svc.AcceptInvite(ctx, token, userID)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invite already accepted")
}

func TestService_AcceptInvite_Expired(t *testing.T) {
	repo := newMockRepo()
	svc := organization.NewService(repo)

	userID := uuid.New()
	orgID := uuid.New()
	token := "expired_token"

	repo.invites[uuid.New()] = &organization.Invite{
		ID:             uuid.New(),
		OrganizationID: orgID,
		Email:          "test@example.com",
		Token:          token,
		ExpiresAt:      time.Now().Add(-24 * time.Hour),
	}

	ctx := setupTestContext(userID, orgID, "viewer")
	
	err := svc.AcceptInvite(ctx, token, userID)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invite expired")
}

func TestService_AcceptInvite_AlreadyMember(t *testing.T) {
	repo := newMockRepo()
	svc := organization.NewService(repo)

	userID := uuid.New()
	orgID := uuid.New()
	token := "valid_token"

	repo.invites[uuid.New()] = &organization.Invite{
		ID:             uuid.New(),
		OrganizationID: orgID,
		Email:          "test@example.com",
		Token:          token,
		ExpiresAt:      time.Now().Add(24 * time.Hour),
	}

	repo.members[uuid.New()] = &organization.Member{
		ID:             uuid.New(),
		OrganizationID: orgID,
		UserID:         userID,
		Role:           organization.RoleViewer,
	}

	ctx := setupTestContext(userID, orgID, "viewer")
	
	err := svc.AcceptInvite(ctx, token, userID)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "already a member")
}

func TestService_ListInvites(t *testing.T) {
	repo := newMockRepo()
	svc := organization.NewService(repo)

	userID := uuid.New()
	orgID := uuid.New()

	repo.invites[uuid.New()] = &organization.Invite{
		ID:             uuid.New(),
		OrganizationID: orgID,
		Email:          "test1@example.com",
	}

	repo.invites[uuid.New()] = &organization.Invite{
		ID:             uuid.New(),
		OrganizationID: orgID,
		Email:          "test2@example.com",
	}

	ctx := setupTestContext(userID, orgID, "owner")
	
	invites, err := svc.ListInvites(ctx)
	require.NoError(t, err)
	assert.Len(t, invites, 2)
}

func TestService_CancelInvite(t *testing.T) {
	repo := newMockRepo()
	svc := organization.NewService(repo)

	userID := uuid.New()
	orgID := uuid.New()
	inviteID := uuid.New()

	repo.invites[inviteID] = &organization.Invite{
		ID:             inviteID,
		OrganizationID: orgID,
		Email:          "test@example.com",
	}

	ctx := setupTestContext(userID, orgID, "owner")
	
	err := svc.CancelInvite(ctx, inviteID)
	require.NoError(t, err)
	
	_, ok := repo.invites[inviteID]
	assert.False(t, ok)
}
