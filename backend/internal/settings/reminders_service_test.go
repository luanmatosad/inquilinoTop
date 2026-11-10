package settings_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/settings"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReminders_SemConfiguracaoDevolveOsPadroes(t *testing.T) {
	got, err := settings.NewService(newMock()).GetReminders(context.Background(), org)
	require.NoError(t, err)
	assert.Equal(t, settings.DefaultReminders(), got)
}

func TestReminders_SalvaOrdenadoEDevolve(t *testing.T) {
	svc := settings.NewService(newMock())
	saved, err := svc.SaveReminders(context.Background(), org, uuid.New(), settings.RemindersInput{Reminders: []settings.Reminder{
		{Name: "Atraso", OffsetDays: 5, Body: "Atrasou {valor}"},
		{Name: " Antes ", OffsetDays: -2, Body: "Vence {vencimento}"},
	}})
	require.NoError(t, err)
	require.Len(t, saved, 2)
	assert.Equal(t, -2, saved[0].OffsetDays)
	assert.Equal(t, "Antes", saved[0].Name)
	got, _ := svc.GetReminders(context.Background(), org)
	assert.Equal(t, saved, got)
}

func TestReminders_InvalidoNaoGrava(t *testing.T) {
	repo := newMock()
	_, err := settings.NewService(repo).SaveReminders(context.Background(), org, uuid.New(), settings.RemindersInput{Reminders: []settings.Reminder{{Name: "X", OffsetDays: 0, Body: "Oi {nom}"}}})
	assert.ErrorIs(t, err, settings.ErrInvalidReminders)
	assert.Empty(t, repo.reminders)
}

func TestReminders_OutraOrganizacaoVeOsPadroes(t *testing.T) {
	svc := settings.NewService(newMock())
	_, err := svc.SaveReminders(context.Background(), org, uuid.New(), settings.RemindersInput{Reminders: []settings.Reminder{{Name: "X", OffsetDays: 0, Body: "ok"}}})
	require.NoError(t, err)
	got, _ := svc.GetReminders(context.Background(), uuid.New())
	assert.Equal(t, settings.DefaultReminders(), got)
}
