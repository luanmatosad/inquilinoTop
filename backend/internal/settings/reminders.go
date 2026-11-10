package settings

import (
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"unicode/utf8"
)

// ErrInvalidReminders: a lista de lembretes não passou na validação (HTTP 400). O erro concreto traz a mensagem.
var ErrInvalidReminders = errors.New("settings: lembretes inválidos")

// ReminderError é um problema da lista de lembretes, com a mensagem pronta para o usuário.
type ReminderError struct{ Msg string }

func (e *ReminderError) Error() string        { return e.Msg }
func (e *ReminderError) Is(target error) bool { return target == ErrInvalidReminders }

// Limites da lista (os mesmos dos CHECKs da migration 000054).
const (
	MaxReminders      = 8
	MaxReminderName   = 40
	MaxReminderBody   = 1000
	MinReminderOffset = -30
	MaxReminderOffset = 60
)

// ReminderVariables são as únicas variáveis aceitas no texto: o que sobrar entre chaves é erro de digitação.
var ReminderVariables = []string{"nome", "valor", "vencimento", "imóvel", "mês", "pix", "link"}

// Reminder é um lembrete: quando (dias em relação ao vencimento, negativo antes) e o que dizer.
type Reminder struct {
	Name       string `json:"name"`
	OffsetDays int    `json:"offset_days"`
	Body       string `json:"body"`
}

// RemindersInput é o corpo de `PUT /settings/reminders`.
type RemindersInput struct {
	Reminders []Reminder `json:"reminders"`
}

var variableRe = regexp.MustCompile(`\{([^{}]*)\}`)

func invalid(format string, a ...any) error { return &ReminderError{Msg: fmt.Sprintf(format, a...)} }

// DefaultReminders são os quatro lembretes do canvas, para quem nunca configurou.
func DefaultReminders() []Reminder {
	const pay = "Pague pelo Pix e avise por aqui: {link}"
	return []Reminder{
		{Name: "Lembrete gentil", OffsetDays: -3, Body: "Oi, {nome}! Passando para lembrar do aluguel de {mês} ({imóvel}): {valor}, vence em {vencimento}.\n\n" + pay},
		{Name: "Cobrança com Pix", OffsetDays: 0, Body: "Oi, {nome}! Hoje vence o aluguel de {mês} ({imóvel}): {valor}.\n\n" + pay},
		{Name: "Aviso de atraso", OffsetDays: 3, Body: "Oi, {nome}! O aluguel de {mês} ({imóvel}) venceu em {vencimento} e ainda está em aberto: {valor}, com multa e juros até hoje.\n\n" + pay},
		{Name: "Segundo aviso, tom mais firme", OffsetDays: 10, Body: "{nome}, o aluguel de {mês} ({imóvel}) está em atraso desde {vencimento}: {valor}, com multa e juros até hoje. Preciso resolver isso ainda esta semana.\n\n" + pay + "\n\nSe houver algum problema, me avise para combinarmos."},
	}
}

func knownVariable(name string) bool {
	for _, v := range ReminderVariables {
		if v == name {
			return true
		}
	}
	return false
}

// ValidateReminders confere a lista (de 1 a 8, nome, dias únicos de -30 a 60, texto e variáveis) e a devolve aparada
// e ordenada por dias.
func ValidateReminders(in []Reminder) ([]Reminder, error) {
	if len(in) < 1 || len(in) > MaxReminders {
		return nil, invalid("informe de 1 a %d lembretes", MaxReminders)
	}
	out := make([]Reminder, 0, len(in))
	seen := map[int]bool{}
	for _, r := range in {
		name, body := strings.TrimSpace(r.Name), strings.TrimSpace(r.Body)
		if n := utf8.RuneCountInString(name); n < 1 || n > MaxReminderName {
			return nil, invalid("o nome do lembrete vai de 1 a %d caracteres", MaxReminderName)
		}
		if r.OffsetDays < MinReminderOffset || r.OffsetDays > MaxReminderOffset {
			return nil, invalid("os dias vão de %d a %d em relação ao vencimento", MinReminderOffset, MaxReminderOffset)
		}
		if seen[r.OffsetDays] {
			return nil, invalid("dois lembretes não podem ter os mesmos dias (%d)", r.OffsetDays)
		}
		seen[r.OffsetDays] = true
		if n := utf8.RuneCountInString(body); n < 1 || n > MaxReminderBody {
			return nil, invalid("o texto vai de 1 a %d caracteres", MaxReminderBody)
		}
		for _, m := range variableRe.FindAllStringSubmatch(body, -1) {
			if !knownVariable(m[1]) {
				return nil, invalid("variável desconhecida: {%s}", m[1])
			}
		}
		out = append(out, Reminder{Name: name, OffsetDays: r.OffsetDays, Body: body})
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].OffsetDays < out[j].OffsetDays })
	return out, nil
}
