package helper

import "time"

// feriadosPeru son los feriados nacionales de Perú (no laborables) que caen
// dentro del cálculo del plazo de reclamos. INDECOPI cuenta días HÁBILES, así
// que estos días no descuentan plazo.
//
// Mantener actualizado cada año: los feriados con fecha fija se repiten, pero
// conviene revisar los decretos de feriados no laborables adicionales.
// Formato "MM-DD" para los fijos; los movibles (Semana Santa) van con año.
var feriadosPeruFijos = map[string]bool{
	"01-01": true, // Año Nuevo
	"05-01": true, // Día del Trabajo
	"06-29": true, // San Pedro y San Pablo
	"07-23": true, // Día de la Fuerza Aérea
	"07-28": true, // Fiestas Patrias
	"07-29": true, // Fiestas Patrias
	"08-06": true, // Batalla de Junín
	"08-30": true, // Santa Rosa de Lima
	"10-08": true, // Combate de Angamos
	"11-01": true, // Todos los Santos
	"12-08": true, // Inmaculada Concepción
	"12-09": true, // Batalla de Ayacucho
	"12-25": true, // Navidad
}

// feriadosPeruMovibles son fechas que cambian cada año (Semana Santa, etc.).
// Formato "YYYY-MM-DD". Revisar y extender cada diciembre para el año siguiente.
var feriadosPeruMovibles = map[string]bool{
	// 2026
	"2026-04-02": true, // Jueves Santo
	"2026-04-03": true, // Viernes Santo
	// 2027
	"2027-03-25": true, // Jueves Santo
	"2027-03-26": true, // Viernes Santo
}

// esHabil indica si un día cuenta como hábil: ni fin de semana ni feriado.
func esHabil(d time.Time) bool {
	switch d.Weekday() {
	case time.Saturday, time.Sunday:
		return false
	}
	if feriadosPeruFijos[d.Format("01-02")] {
		return false
	}
	if feriadosPeruMovibles[d.Format("2006-01-02")] {
		return false
	}
	return true
}

// CalcularFechaLimite calcula la fecha límite de respuesta contando días
// HÁBILES desde el registro, como exige INDECOPI para el libro de
// reclamaciones. No cuenta sábados, domingos ni feriados nacionales.
func CalcularFechaLimite(fechaRegistro time.Time, plazoDiasHabiles int) time.Time {
	d := fechaRegistro
	restantes := plazoDiasHabiles
	// Avanza día a día sumando solo los hábiles hasta agotar el plazo.
	for restantes > 0 {
		d = d.AddDate(0, 0, 1)
		if esHabil(d) {
			restantes--
		}
	}
	return d
}

// DiasHabilesRestantes cuenta los días hábiles que quedan hasta la fecha
// límite. Negativo si ya venció. Se usa para priorizar y alertar.
func DiasHabilesRestantes(fechaLimite time.Time) int {
	hoy := time.Now().Truncate(24 * time.Hour)
	limite := fechaLimite.Truncate(24 * time.Hour)

	if limite.Equal(hoy) {
		return 0
	}

	if limite.After(hoy) {
		count := 0
		d := hoy
		for d.Before(limite) {
			d = d.AddDate(0, 0, 1)
			if esHabil(d) {
				count++
			}
		}
		return count
	}

	// Ya venció: días hábiles pasados, en negativo.
	count := 0
	d := limite
	for d.Before(hoy) {
		d = d.AddDate(0, 0, 1)
		if esHabil(d) {
			count++
		}
	}
	return -count
}

// DiasRestantes se conserva por compatibilidad, ahora en días hábiles.
func DiasRestantes(fechaLimite time.Time) int {
	return DiasHabilesRestantes(fechaLimite)
}

// Prioridad calcula la prioridad de un reclamo basado en días hábiles restantes.
func Prioridad(fechaLimite time.Time, estado string) string {
	if estado == "RESUELTO" || estado == "CERRADO" {
		return "COMPLETADO"
	}
	dias := DiasHabilesRestantes(fechaLimite)
	switch {
	case dias < 0:
		return "VENCIDO"
	case dias <= 3:
		return "URGENTE"
	default:
		return "EN_TIEMPO"
	}
}

// InicioMesActual retorna el primer día del mes actual a las 00:00.
// Se usa para contar reclamos del mes (límite del plan).
func InicioMesActual() time.Time {
	now := time.Now()
	return time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
}
