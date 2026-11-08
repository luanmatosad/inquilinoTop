package payment

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
)

// Erros do link público e do aviso do inquilino.
var (
	// ErrPublicURLNotConfigured: APP_PUBLIC_URL ausente, não dá para montar o link (HTTP 422).
	ErrPublicURLNotConfigured = errors.New("payment: URL pública não configurada")
	// ErrInvalidReport: valor do aviso inválido (HTTP 400).
	ErrInvalidReport = errors.New("payment: aviso inválido")
	// ErrInvalidPaidDate: data do pagamento futura ou com mais de 60 dias (HTTP 400).
	ErrInvalidPaidDate = errors.New("payment: data do pagamento inválida")
	// ErrProofTooLarge: comprovante acima de MaxProofBytes (HTTP 413).
	ErrProofTooLarge = errors.New("payment: comprovante grande demais")
	// ErrProofType: comprovante que não é JPEG, PNG nem PDF (HTTP 415).
	ErrProofType = errors.New("payment: tipo de comprovante não permitido")
	// ErrNoPendingReport: a cobrança não tem aviso pendente (HTTP 409).
	ErrNoPendingReport = errors.New("payment: sem aviso pendente")
)

const (
	linkAfterDueDays  = 90
	linkMinDays       = 30
	linkAfterPaidDays = 365
	reportMaxAgeDays  = 60
	statusAwaiting    = "AWAITING_CONFIRMATION"
)

// WithPublicLinks habilita o link público; publicURL é a base (ex.: https://app.imoviflow.com.br).
func (s *Service) WithPublicLinks(store LinkStore, publicURL string) *Service {
	s.links = store
	s.publicURL = strings.TrimRight(strings.TrimSpace(publicURL), "/")
	return s
}

// WithReports habilita o aviso "já paguei" e o armazenamento do comprovante.
func (s *Service) WithReports(store ReportStore, proofs ProofStorage) *Service {
	s.reports = store
	s.proofs = proofs
	return s
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func addDays(t time.Time, n int) time.Time { return t.AddDate(0, 0, n) }

func maxTime(a, b time.Time) time.Time {
	if b.After(a) {
		return b
	}
	return a
}

// CreateLink cria o link público da cobrança e revoga o anterior. A URL com o token só existe nesta resposta.
func (s *Service) CreateLink(ctx context.Context, id, orgID, actorID uuid.UUID) (*LinkResult, error) {
	if s.links == nil || s.publicURL == "" {
		return nil, ErrPublicURLNotConfigured
	}
	p, err := s.repo.GetByID(ctx, id, orgID)
	if err != nil {
		return nil, err
	}
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return nil, fmt.Errorf("payment.svc: token: %w", err)
	}
	token := base64.RawURLEncoding.EncodeToString(raw)
	expires := maxTime(addDays(p.DueDate, linkAfterDueDays), addDays(s.now(), linkMinDays))
	var by *uuid.UUID
	if actorID != uuid.Nil {
		by = &actorID
	}
	if err := s.links.RotateLink(ctx, orgID, id, by, hashToken(token), expires); err != nil {
		return nil, fmt.Errorf("payment.svc: link: %w", err)
	}
	return &LinkResult{URL: s.publicURL + "/p/" + token, ExpiresAt: expires}, nil
}

// effectiveExpiry estende a validade gravada: vencimento + 90 dias (acordo move o vencimento) e, se paga, pagamento + 365.
func effectiveExpiry(l *PaymentLink, p *Payment) time.Time {
	exp := maxTime(l.ExpiresAt, addDays(p.DueDate, linkAfterDueDays))
	if p.Status == "PAID" && p.PaidDate != nil {
		exp = maxTime(exp, addDays(*p.PaidDate, linkAfterPaidDays))
	}
	return exp
}

// resolveLink devolve o link e a cobrança do token. Token inexistente, revogado ou expirado dá sempre ErrNotFound.
func (s *Service) resolveLink(ctx context.Context, token string) (*PaymentLink, *Payment, error) {
	if s.links == nil || token == "" {
		return nil, nil, apierr.ErrNotFound
	}
	l, err := s.links.GetLinkByHash(ctx, hashToken(token))
	if err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			return nil, nil, apierr.ErrNotFound
		}
		return nil, nil, fmt.Errorf("payment.svc: link: %w", err)
	}
	if l.RevokedAt != nil {
		return nil, nil, apierr.ErrNotFound
	}
	p, err := s.repo.GetByID(ctx, l.PaymentID, l.OrganizationID)
	if err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			return nil, nil, apierr.ErrNotFound
		}
		return nil, nil, fmt.Errorf("payment.svc: %w", err)
	}
	if !s.now().Before(effectiveExpiry(l, p)) {
		return nil, nil, apierr.ErrNotFound
	}
	return l, p, nil
}

func linkUserID(l *PaymentLink) uuid.UUID {
	if l.CreatedBy == nil {
		return uuid.Nil
	}
	return *l.CreatedBy
}

// PublicView monta a cobrança para a página pública, só com o que o inquilino precisa ver.
func (s *Service) PublicView(ctx context.Context, token string) (*PublicView, error) {
	l, p, err := s.resolveLink(ctx, token)
	if err != nil {
		return nil, err
	}
	e := s.Enrich(ctx, *p)

	v := &PublicView{
		DueDate:     e.DueDate,
		Competency:  e.Competency,
		Description: e.Description,
		PaidDate:    e.PaidDate,
	}
	if uid := linkUserID(l); uid != uuid.Nil {
		if ow, err := s.ownerReader.GetByID(ctx, uid); err == nil && ow != nil {
			v.LandlordName = ow.Name
		}
	}
	if ls, err := s.leaseReader.GetByID(ctx, e.LeaseID, e.OrganizationID); err == nil {
		if u, err := s.unitReader.GetByID(ctx, ls.UnitID, e.OrganizationID); err == nil {
			v.UnitLabel = u.Label
		}
	}

	if e.Status == "PAID" {
		v.Status = "PAID"
		v.Amount = e.GrossAmount
		if e.NetAmount != nil {
			v.Amount = *e.NetAmount
		}
		if e.ReceiptNumber != nil && e.ReceiptYear != nil {
			n := fmt.Sprintf("%04d/%d", *e.ReceiptNumber, *e.ReceiptYear)
			v.ReceiptNumber = &n
		}
		return v, nil
	}

	v.Amount = round2(e.GrossAmount + e.LateFeeAmount + e.InterestAmount)
	switch {
	case e.AwaitingConfirmation:
		v.Status = statusAwaiting
		v.ReportedAt, v.ReportedAmount, v.ReportedDate = e.ReportedAt, e.ReportedAmount, e.ReportedDate
	case e.Status == "LATE":
		v.Status = "LATE"
	default:
		v.Status = "PENDING"
	}
	return v, nil
}

// PublicPix devolve o Pix copia-e-cola do dia pela página pública.
func (s *Service) PublicPix(ctx context.Context, token string) (*PixCode, error) {
	l, p, err := s.resolveLink(ctx, token)
	if err != nil {
		return nil, err
	}
	return s.PixPayload(ctx, p.ID, p.OrganizationID, linkUserID(l))
}

// PublicReceipt devolve o recibo da cobrança paga sem documentos nem endereço.
func (s *Service) PublicReceipt(ctx context.Context, token string) (*Receipt, error) {
	l, p, err := s.resolveLink(ctx, token)
	if err != nil {
		return nil, err
	}
	r, err := s.BuildReceipt(ctx, p.ID, p.OrganizationID, linkUserID(l))
	if err != nil {
		return nil, err
	}
	r.PaymentID = uuid.Nil
	r.Owner.Document = nil
	r.Tenant.Document = nil
	r.Unit.PropertyAddress = nil
	return r, nil
}

// sniffProof confere o tipo pelo conteúdo (nunca pelo nome) e devolve o tipo e a extensão.
func sniffProof(data []byte) (ctype, ext string, err error) {
	head := data
	if len(head) > 512 {
		head = head[:512]
	}
	switch ct := http.DetectContentType(head); ct {
	case "image/jpeg":
		return ct, ".jpg", nil
	case "image/png":
		return ct, ".png", nil
	case "application/pdf":
		return ct, ".pdf", nil
	}
	return "", "", ErrProofType
}

func proofContentType(path string) string {
	switch {
	case strings.HasSuffix(path, ".png"):
		return "image/png"
	case strings.HasSuffix(path, ".pdf"):
		return "application/pdf"
	default:
		return "image/jpeg"
	}
}

// ReportPaid grava o "já paguei" do inquilino. Cobrança paga recusa; novo aviso substitui o anterior.
func (s *Service) ReportPaid(ctx context.Context, token string, in ReportInput) error {
	_, p, err := s.resolveLink(ctx, token)
	if err != nil {
		return err
	}
	if s.reports == nil {
		return fmt.Errorf("payment.svc: avisos não configurados")
	}
	if p.Status == "PAID" {
		return errAlreadyPaid
	}
	if in.Amount <= 0 || in.Amount > 10_000_000 {
		return fmt.Errorf("payment.svc: %w", ErrInvalidReport)
	}
	y, m, d := in.PaidDate.Date()
	date := time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
	today := s.today()
	if date.After(today) || date.Before(addDays(today, -reportMaxAgeDays)) {
		return fmt.Errorf("payment.svc: %w", ErrInvalidPaidDate)
	}

	var ext string
	if len(in.Proof) > 0 {
		if len(in.Proof) > MaxProofBytes {
			return ErrProofTooLarge
		}
		if _, ext, err = sniffProof(in.Proof); err != nil {
			return err
		}
		if s.proofs == nil {
			return fmt.Errorf("payment.svc: comprovantes não configurados")
		}
	}

	apply := ReportApply{Amount: round2(in.Amount), PaidDate: date}
	if ext != "" {
		path, err := s.proofs.Save(ctx, p.OrganizationID, "comprovante"+ext, bytes.NewReader(in.Proof))
		if err != nil {
			return fmt.Errorf("payment.svc: salvar comprovante: %w", err)
		}
		apply.ProofPath = &path
	}
	old, err := s.reports.SaveReport(ctx, p.OrganizationID, p.ID, apply)
	if err != nil {
		s.deleteProof(ctx, apply.ProofPath)
		return fmt.Errorf("payment.svc: aviso: %w", err)
	}
	s.deleteProof(ctx, old)
	return nil
}

func (s *Service) deleteProof(ctx context.Context, path *string) {
	if path != nil && s.proofs != nil {
		_ = s.proofs.Delete(ctx, *path)
	}
}

func (s *Service) pendingReport(ctx context.Context, id, orgID uuid.UUID) (*Payment, error) {
	p, err := s.repo.GetByID(ctx, id, orgID)
	if err != nil {
		return nil, err
	}
	if p.Status == "PAID" {
		return nil, errAlreadyPaid
	}
	if p.ReportedAt == nil || p.ReportedDate == nil {
		return nil, ErrNoPendingReport
	}
	return p, nil
}

// ConfirmReport baixa a cobrança pelo aviso do inquilino: Pix, na data informada, com desconto opcional.
func (s *Service) ConfirmReport(ctx context.Context, id, orgID, actorID uuid.UUID, in ConfirmInput) (*Payment, error) {
	p, err := s.pendingReport(ctx, id, orgID)
	if err != nil {
		return nil, err
	}
	method := "PIX"
	return s.markPaid(ctx, id, orgID, actorID, *p.ReportedDate, UpdatePaymentInput{
		Status: "PAID", PaymentMethod: &method, DiscountAmount: in.Discount, PaymentNote: in.Note,
	})
}

// RejectReport recusa o aviso ("ainda não recebi"): limpa os dados, apaga o comprovante e grava REJECTED.
func (s *Service) RejectReport(ctx context.Context, id, orgID, actorID uuid.UUID) error {
	if _, err := s.pendingReport(ctx, id, orgID); err != nil {
		return err
	}
	if s.reports == nil {
		return fmt.Errorf("payment.svc: avisos não configurados")
	}
	var actor *uuid.UUID
	if actorID != uuid.Nil {
		actor = &actorID
	}
	old, err := s.reports.ClearReport(ctx, orgID, id, actor)
	if err != nil {
		return fmt.Errorf("payment.svc: recusar aviso: %w", err)
	}
	s.deleteProof(ctx, old)
	return nil
}

// ProofFile abre o comprovante do aviso. Só o dono, escopado à organização.
func (s *Service) ProofFile(ctx context.Context, id, orgID uuid.UUID) (io.ReadCloser, string, error) {
	p, err := s.repo.GetByID(ctx, id, orgID)
	if err != nil {
		return nil, "", err
	}
	if p.ProofPath == nil || s.proofs == nil {
		return nil, "", apierr.ErrNotFound
	}
	rc, err := s.proofs.Load(ctx, *p.ProofPath)
	if err != nil {
		return nil, "", apierr.ErrNotFound
	}
	return rc, proofContentType(*p.ProofPath), nil
}
