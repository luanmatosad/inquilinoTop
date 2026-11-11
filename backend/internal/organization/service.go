package organization

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
)

var ErrAlreadyHasOrganization = errors.New("usuário já possui organização")

var (
	ErrInviteNotFound    = errors.New("convite não encontrado")
	ErrInviteExpired     = errors.New("convite expirado")
	ErrInviteAlreadyUsed = errors.New("convite já utilizado")
	ErrInviteBranchGone  = errors.New("filial do convite não existe mais")
)

// InviteNotifier enfileira o e-mail do convite. Quem envia é o worker de notificações, não o service.
type InviteNotifier interface {
	NotifyInvite(ctx context.Context, invitedBy uuid.UUID, toEmail, orgName, acceptURL string) error
}

type Service struct {
	repo        Repository
	notifier    InviteNotifier
	frontendURL string
}

// NewService recebe o notificador do convite e a URL pública do frontend (base do link de aceite).
func NewService(repo Repository, notifier InviteNotifier, frontendURL string) *Service {
	return &Service{repo: repo, notifier: notifier, frontendURL: frontendURL}
}

func (s *Service) getOrgID(ctx context.Context) (uuid.UUID, error) {
	orgID := auth.OrganizationIDFromCtx(ctx)
	if orgID == uuid.Nil {
		return uuid.Nil, fmt.Errorf("organização não encontrada no contexto")
	}
	return orgID, nil
}

func (s *Service) getOwnerID(ctx context.Context) (uuid.UUID, error) {
	ownerID := auth.OwnerIDFromCtx(ctx)
	if ownerID == uuid.Nil {
		return uuid.Nil, fmt.Errorf("usuário não encontrado no contexto")
	}
	return ownerID, nil
}

func (s *Service) GetOrganization(ctx context.Context) (*Organization, error) {
	orgID, err := s.getOrgID(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, orgID)
}

func (s *Service) GetMyOrganization(ctx context.Context) (*Organization, error) {
	ownerID, err := s.getOwnerID(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.GetByUserID(ctx, ownerID)
}

func (s *Service) UpdateOrganization(ctx context.Context, in UpdateOrgInput) (*Organization, error) {
	orgID, err := s.getOrgID(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.Update(ctx, orgID, in)
}

func (s *Service) CreateOrganization(ctx context.Context, in CreateOrgInput) (*Organization, error) {
	ownerID, err := s.getOwnerID(ctx)
	if err != nil {
		return nil, err
	}
	existing, err := s.repo.GetByUserID(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrAlreadyHasOrganization
	}
	return s.repo.CreateWithOwner(ctx, in.Name, ownerID)
}

func (s *Service) CreateBranch(ctx context.Context, in CreateBranchInput) (*Branch, error) {
	orgID, err := s.getOrgID(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.CreateBranch(ctx, orgID, in)
}

func (s *Service) GetBranch(ctx context.Context, branchID uuid.UUID) (*Branch, error) {
	orgID, err := s.getOrgID(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.GetBranch(ctx, branchID, orgID)
}

func (s *Service) ListBranches(ctx context.Context) ([]Branch, error) {
	orgID, err := s.getOrgID(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.ListBranches(ctx, orgID)
}

func (s *Service) UpdateBranch(ctx context.Context, branchID uuid.UUID, in UpdateBranchInput) (*Branch, error) {
	orgID, err := s.getOrgID(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.UpdateBranch(ctx, branchID, orgID, in)
}

func (s *Service) DeleteBranch(ctx context.Context, branchID uuid.UUID) error {
	orgID, err := s.getOrgID(ctx)
	if err != nil {
		return err
	}
	return s.repo.DeleteBranch(ctx, branchID, orgID)
}

func (s *Service) GetMembership(ctx context.Context, userID uuid.UUID) (*Member, error) {
	orgID, err := s.getOrgID(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.GetMembership(ctx, userID, orgID)
}

func (s *Service) GetMembershipByID(ctx context.Context, memberID uuid.UUID) (*Member, error) {
	return s.repo.GetMembershipByID(ctx, memberID)
}

func (s *Service) ListMembers(ctx context.Context) ([]Member, error) {
	orgID, err := s.getOrgID(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.ListMembers(ctx, orgID)
}

func (s *Service) UpdateMemberRole(ctx context.Context, memberID uuid.UUID, in UpdateMemberRoleInput) (*Member, error) {
	member, err := s.repo.GetMembershipByID(ctx, memberID)
	if err != nil {
		return nil, fmt.Errorf("member not found: %w", err)
	}
	if member == nil {
		return nil, fmt.Errorf("member not found")
	}
	orgID, err := s.getOrgID(ctx)
	if err != nil {
		return nil, err
	}
	if member.OrganizationID != orgID {
		return nil, fmt.Errorf("member not found")
	}
	if member.Role == RoleOwner {
		return nil, fmt.Errorf("cannot change owner role")
	}
	if in.Role == RoleOwner {
		return nil, fmt.Errorf("cannot promote to owner")
	}
	if err := s.repo.UpdateMemberRole(ctx, memberID, in.Role); err != nil {
		return nil, fmt.Errorf("update role: %w", err)
	}
	return s.repo.GetMembershipByID(ctx, memberID)
}

func (s *Service) RemoveMember(ctx context.Context, memberID uuid.UUID) error {
	member, err := s.repo.GetMembershipByID(ctx, memberID)
	if err != nil {
		return fmt.Errorf("member not found: %w", err)
	}
	if member == nil {
		return fmt.Errorf("member not found")
	}
	orgID, err := s.getOrgID(ctx)
	if err != nil {
		return err
	}
	if member.OrganizationID != orgID {
		return fmt.Errorf("member not found")
	}
	if member.Role == RoleOwner {
		return fmt.Errorf("cannot remove owner")
	}
	ownerID, err := s.getOwnerID(ctx)
	if err != nil {
		return err
	}
	if member.UserID == ownerID {
		return fmt.Errorf("cannot remove yourself")
	}
	return s.repo.RemoveMember(ctx, memberID, orgID)
}

func generateToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("rand: %w", err)
	}
	return hex.EncodeToString(bytes), nil
}

// hashToken guarda o convite como SHA-256 hex: o banco nunca recebe o token bruto.
func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (s *Service) CreateInvite(ctx context.Context, in CreateInviteInput) (*InviteCreated, error) {
	token, err := generateToken()
	if err != nil {
		return nil, fmt.Errorf("generate token: %w", err)
	}
	expiresAt := time.Now().Add(72 * time.Hour)
	orgID, err := s.getOrgID(ctx)
	if err != nil {
		return nil, err
	}
	ownerID, err := s.getOwnerID(ctx)
	if err != nil {
		return nil, err
	}
	org, err := s.repo.GetByID(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("create invite: organization: %w", err)
	}
	if org == nil {
		return nil, fmt.Errorf("create invite: organização não encontrada")
	}
	invite, err := s.repo.CreateInvite(ctx, in, orgID, ownerID, hashToken(token), expiresAt)
	if err != nil {
		return nil, err
	}
	// O convite já está gravado e o token volta na resposta: falha ao enfileirar o e-mail não o desfaz.
	// Não há reenvio; quem convidou copia o link da resposta ou cancela e convida de novo.
	acceptURL := s.frontendURL + "/invite/accept?token=" + token
	if err := s.notifier.NotifyInvite(ctx, ownerID, invite.Email, org.Name, acceptURL); err != nil {
		slog.Error("organization: enfileirar e-mail do convite", "invite_id", invite.ID, "org_id", orgID, "error", err)
	}
	return &InviteCreated{Invite: *invite, Token: token}, nil
}

func (s *Service) GetInviteByToken(ctx context.Context, token string) (*Invite, error) {
	return s.repo.GetInviteByToken(ctx, hashToken(token))
}

func (s *Service) ListInvites(ctx context.Context) ([]Invite, error) {
	orgID, err := s.getOrgID(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.ListInvites(ctx, orgID)
}

func (s *Service) CancelInvite(ctx context.Context, inviteID uuid.UUID) error {
	orgID, err := s.getOrgID(ctx)
	if err != nil {
		return err
	}
	return s.repo.CancelInvite(ctx, inviteID, orgID)
}

func (s *Service) AcceptInvite(ctx context.Context, token string, userID uuid.UUID) error {
	email, err := s.repo.GetUserEmail(ctx, userID)
	if err != nil {
		return fmt.Errorf("accept invite: user email: %w", err)
	}
	invite, err := s.repo.GetInviteByToken(ctx, hashToken(token))
	if err != nil {
		return fmt.Errorf("accept invite: lookup: %w", err)
	}
	// Convite de outra pessoa responde igual a convite inexistente: não revela que o token existe.
	if invite == nil || !strings.EqualFold(invite.Email, email) {
		return ErrInviteNotFound
	}
	if invite.AcceptedAt != nil {
		return ErrInviteAlreadyUsed
	}
	if time.Now().After(invite.ExpiresAt) {
		return ErrInviteExpired
	}
	if invite.BranchID != nil {
		branch, err := s.repo.GetBranch(ctx, *invite.BranchID, invite.OrganizationID)
		if err != nil {
			return fmt.Errorf("accept invite: branch: %w", err)
		}
		if branch == nil {
			return ErrInviteBranchGone
		}
	}
	return s.repo.AcceptInvite(ctx, invite, userID)
}

func (s *Service) HasRole(ctx context.Context, role RoleType) (bool, error) {
	ownerID, err := s.getOwnerID(ctx)
	if err != nil {
		return false, err
	}
	orgID, err := s.getOrgID(ctx)
	if err != nil {
		return false, err
	}
	return s.repo.HasRole(ctx, ownerID, orgID, role)
}

var _ ServiceInterface = (*Service)(nil)

type ServiceInterface interface {
	GetOrganization(ctx context.Context) (*Organization, error)
	GetMyOrganization(ctx context.Context) (*Organization, error)
	UpdateOrganization(ctx context.Context, in UpdateOrgInput) (*Organization, error)
	CreateOrganization(ctx context.Context, in CreateOrgInput) (*Organization, error)
	CreateBranch(ctx context.Context, in CreateBranchInput) (*Branch, error)
	GetBranch(ctx context.Context, branchID uuid.UUID) (*Branch, error)
	ListBranches(ctx context.Context) ([]Branch, error)
	UpdateBranch(ctx context.Context, branchID uuid.UUID, in UpdateBranchInput) (*Branch, error)
	DeleteBranch(ctx context.Context, branchID uuid.UUID) error
	GetMembership(ctx context.Context, userID uuid.UUID) (*Member, error)
	GetMembershipByID(ctx context.Context, memberID uuid.UUID) (*Member, error)
	ListMembers(ctx context.Context) ([]Member, error)
	UpdateMemberRole(ctx context.Context, memberID uuid.UUID, in UpdateMemberRoleInput) (*Member, error)
	RemoveMember(ctx context.Context, memberID uuid.UUID) error
	CreateInvite(ctx context.Context, in CreateInviteInput) (*InviteCreated, error)
	GetInviteByToken(ctx context.Context, token string) (*Invite, error)
	ListInvites(ctx context.Context) ([]Invite, error)
	CancelInvite(ctx context.Context, inviteID uuid.UUID) error
	AcceptInvite(ctx context.Context, token string, userID uuid.UUID) error
	HasRole(ctx context.Context, role RoleType) (bool, error)
}
