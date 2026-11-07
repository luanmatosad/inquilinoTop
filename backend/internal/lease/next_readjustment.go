package lease

import "time"

// NextReadjustment devolve o próximo mês de reajuste (sempre dia 1). Sem mês de reajuste, nil.
//
//   - Sem reajuste aplicado: o primeiro mês `month` que caia pelo menos 12 meses depois do início.
//   - Com reajuste aplicado (depois do início): o ciclo do mês `month` mais próximo da data aplicada
//     (empate vale o ciclo anterior) mais 12 meses. Assim um reajuste feito com atraso ou adiantado
//     não desloca o aniversário do contrato.
//
// Se o aniversário já passou sem reajuste registrado, o resultado fica no passado: quem exibe decide
// tratá-lo como "reajuste pendente".
func NextReadjustment(month *int, start time.Time, lastApplied *time.Time) *time.Time {
	if month == nil || *month < 1 || *month > 12 {
		return nil
	}
	m := *month - 1 // mês de reajuste, base 0

	var idx int // índice absoluto do mês (ano*12 + mês base 0) do próximo reajuste
	if lastApplied != nil && lastApplied.After(start) {
		a := lastApplied.Year()*12 + int(lastApplied.Month()) - 1
		cycle := (a - m + 5) / 12 // ocorrência de `m` mais próxima de `a`; empate fica com a anterior
		idx = m + 12*(cycle+1)
	} else {
		earliest := start.Year()*12 + int(start.Month()) - 1 + 12
		idx = earliest - ((earliest-m)%12+12)%12 // ocorrência de `m` que seja <= earliest...
		if idx < earliest {
			idx += 12 // ...e então a primeira que seja >= earliest
		}
	}
	next := time.Date(idx/12, time.Month(idx%12+1), 1, 0, 0, 0, 0, time.UTC)
	return &next
}
