package payment_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/payment"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockPixAccounts devolve a conta Pix escolhida (ou nenhuma, ou erro) e guarda a unidade pedida.
type mockPixAccounts struct {
	acct    *payment.PixAccount
	err     error
	gotUnit uuid.UUID
	calls   int
}

func (m *mockPixAccounts) ResolvePixAccount(_ context.Context, _, unitID uuid.UUID) (*payment.PixAccount, error) {
	m.calls++
	m.gotUnit = unitID
	return m.acct, m.err
}

var in20 = time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC)

func TestPixPayload_ContaDaUnidadeVenceAChaveAntiga(t *testing.T) {
	legacy := "legacy@email.com"
	ts, p, org, user := pixSetup(t, &legacy, in20)
	res := &mockPixAccounts{acct: &payment.PixAccount{Key: "11222333000181", ReceiverName: "Centro Empresarial Ltda"}}
	ts.WithPixAccounts(res)

	code, err := ts.PixPayload(context.Background(), p.ID, org, user)
	require.NoError(t, err)
	assert.Contains(t, code.Payload, "11222333000181")
	assert.NotContains(t, code.Payload, "legacy@email.com")
	assert.Contains(t, code.Payload, "5923CENTRO EMPRESARIAL LTDA", "nome da conta, não o do perfil")
	assert.Contains(t, code.Payload, "6009SAO PAULO", "a conta da unidade não tem cidade: vale a do imóvel")
	assert.Equal(t, "CENTRO EMPRESARIAL LTDA", code.ReceiverName)
	assert.Equal(t, ts.leaseReader.leases[p.LeaseID].UnitID, res.gotUnit, "resolve pela unidade do contrato")
}

func TestPixPayload_ContaDaOrganizacaoComCidadeENome(t *testing.T) {
	ts, p, org, user := pixSetup(t, nil, in20)
	ts.WithPixAccounts(&mockPixAccounts{acct: &payment.PixAccount{Key: "org@email.com", ReceiverName: "Luan Matos", City: "Manaus"}})

	code, err := ts.PixPayload(context.Background(), p.ID, org, user)
	require.NoError(t, err, "sem chave antiga também funciona")
	assert.Contains(t, code.Payload, "org@email.com")
	assert.Contains(t, code.Payload, "5910LUAN MATOS")
	assert.Contains(t, code.Payload, "6006MANAUS")
	assert.Equal(t, "LUAN MATOS", code.ReceiverName)
}

func TestPixPayload_ContaSemNomeUsaONomeDoPerfil(t *testing.T) {
	ts, p, org, user := pixSetup(t, nil, in20)
	ts.WithPixAccounts(&mockPixAccounts{acct: &payment.PixAccount{Key: "org@email.com"}})
	code, err := ts.PixPayload(context.Background(), p.ID, org, user)
	require.NoError(t, err)
	assert.Equal(t, "LUAN MATOS DE ABREU DIAS", code.ReceiverName)
}

func TestPixPayload_SemContaCaiNaChaveAntiga(t *testing.T) {
	legacy := "legacy@email.com"
	ts, p, org, user := pixSetup(t, &legacy, in20)
	ts.WithPixAccounts(&mockPixAccounts{acct: nil})
	code, err := ts.PixPayload(context.Background(), p.ID, org, user)
	require.NoError(t, err)
	assert.Contains(t, code.Payload, "legacy@email.com")
	assert.Equal(t, "LUAN MATOS DE ABREU DIAS", code.ReceiverName)
}

func TestPixPayload_SemContaNemChaveAntiga(t *testing.T) {
	ts, p, org, user := pixSetup(t, nil, in20)
	ts.WithPixAccounts(&mockPixAccounts{acct: nil})
	_, err := ts.PixPayload(context.Background(), p.ID, org, user)
	assert.ErrorIs(t, err, payment.ErrPixKeyNotConfigured)
}

// Se não deu para descobrir a conta, NÃO cai na chave da organização: o dinheiro poderia ir para a conta errada.
func TestPixPayload_ErroNoResolvedorNaoCaiNaChaveAntiga(t *testing.T) {
	legacy := "legacy@email.com"
	ts, p, org, user := pixSetup(t, &legacy, in20)
	ts.WithPixAccounts(&mockPixAccounts{err: errors.New("banco fora do ar")})
	code, err := ts.PixPayload(context.Background(), p.ID, org, user)
	assert.Error(t, err)
	assert.Nil(t, code)
	assert.NotErrorIs(t, err, payment.ErrPixKeyNotConfigured)
}

func TestPixPayload_SemResolvedorContinuaComoAntes(t *testing.T) {
	legacy := "legacy@email.com"
	ts, p, org, user := pixSetup(t, &legacy, in20)
	code, err := ts.PixPayload(context.Background(), p.ID, org, user)
	require.NoError(t, err)
	assert.Contains(t, code.Payload, "legacy@email.com")
}

func TestHandler_Pix_TrazONomeDoRecebedor(t *testing.T) {
	ts, p, org, user := pixSetup(t, nil, in20)
	ts.WithPixAccounts(&mockPixAccounts{acct: &payment.PixAccount{Key: "org@email.com", ReceiverName: "Centro Ltda"}})
	r := eventsRouter(ts, org, user)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/payments/"+p.ID.String()+"/pix", nil))
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	assert.Contains(t, rr.Body.String(), `"receiver_name":"CENTRO LTDA"`)
}
