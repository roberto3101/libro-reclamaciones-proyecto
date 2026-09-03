package service

import (
	"bytes"
	"fmt"
	"math"
	"strings"
	"time"

	"libro-reclamaciones/internal/model"

	"github.com/go-pdf/fpdf"
)

type ExportarPDFServicio struct{}

func NuevoExportarPDFServicio() *ExportarPDFServicio {
	return &ExportarPDFServicio{}
}

// FiltrosReportePDF contiene los filtros aplicados para mostrar en el PDF.
type FiltrosReportePDF struct {
	Periodo    string // "hoy", "semana", "mes", "anio", "" (personalizado/todo)
	FechaDesde string // formato DD/MM/YYYY
	FechaHasta string // formato DD/MM/YYYY
	Sede       string // nombre de la sede o vacío
	Estado     string // estado filtrado o vacío
	Busqueda   string // texto de búsqueda o vacío
}

// GenerarReporteReclamos genera un PDF profesional con la lista de reclamos del tenant.
func (s *ExportarPDFServicio) GenerarReporteReclamos(reclamos []model.Reclamo, nombreEmpresa, rucEmpresa string, filtros *FiltrosReportePDF) ([]byte, error) {
	pdf := fpdf.New("L", "mm", "A4", "")
	rawTr := pdf.UnicodeTranslatorFromDescriptor("")
	// Envolver tr para sanitizar caracteres Unicode problemáticos antes de traducir
	tr := func(s string) string { return rawTr(sanitizarTextoPDF(s)) }
	pdf.SetAutoPageBreak(true, 15)

	pdf.SetHeaderFunc(func() {
		s.dibujarEncabezado(pdf, tr, nombreEmpresa, rucEmpresa, filtros)
	})

	pdf.SetFooterFunc(func() {
		s.dibujarPiePagina(pdf, tr)
	})

	pdf.AddPage()
	s.dibujarTablaReclamos(pdf, tr, reclamos)

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("exportar_pdf: error generando PDF: %w", err)
	}
	return buf.Bytes(), nil
}

func (s *ExportarPDFServicio) dibujarEncabezado(pdf *fpdf.Fpdf, tr func(string) string, empresa, ruc string, filtros *FiltrosReportePDF) {
	ancho, _ := pdf.GetPageSize()

	// Barra superior de color
	pdf.SetFillColor(26, 86, 219)
	pdf.Rect(0, 0, ancho, 3, "F")

	pdf.SetY(6)

	// Título
	pdf.SetFont("Arial", "B", 14)
	pdf.SetTextColor(26, 86, 219)
	pdf.CellFormat(0, 8, tr("Reporte de Reclamos y Quejas"), "", 1, "C", false, 0, "")

	// Empresa + RUC
	pdf.SetFont("Arial", "", 9)
	pdf.SetTextColor(100, 100, 100)
	subtitulo := empresa
	if ruc != "" {
		subtitulo += "  |  RUC: " + ruc
	}
	pdf.CellFormat(0, 5, tr(subtitulo), "", 1, "C", false, 0, "")

	// Línea de filtros aplicados
	if filtros != nil {
		linea := s.construirLineaFiltros(filtros)
		if linea != "" {
			pdf.SetFont("Arial", "B", 8)
			pdf.SetTextColor(26, 86, 219)
			pdf.CellFormat(0, 5, tr("Filtros: "+linea), "", 1, "C", false, 0, "")
		}
	}

	// Fecha de generación
	pdf.SetFont("Arial", "I", 8)
	pdf.SetTextColor(150, 150, 150)
	pdf.CellFormat(0, 4, tr(fmt.Sprintf("Generado el %s", time.Now().Format("02/01/2006 15:04"))), "", 1, "C", false, 0, "")

	// Línea separadora
	pdf.SetY(pdf.GetY() + 1)
	pdf.SetDrawColor(26, 86, 219)
	pdf.SetLineWidth(0.5)
	pdf.Line(10, pdf.GetY(), ancho-10, pdf.GetY())
	pdf.SetY(pdf.GetY() + 3)
}

func (s *ExportarPDFServicio) construirLineaFiltros(f *FiltrosReportePDF) string {
	var partes []string

	// Periodo / rango de fechas
	switch f.Periodo {
	case "hoy":
		partes = append(partes, "Periodo: Hoy")
	case "semana":
		partes = append(partes, "Periodo: Esta semana")
	case "mes":
		partes = append(partes, "Periodo: Este mes")
	case "anio":
		partes = append(partes, "Periodo: Este año")
	default:
		if f.FechaDesde != "" && f.FechaHasta != "" {
			partes = append(partes, fmt.Sprintf("Desde %s hasta %s", f.FechaDesde, f.FechaHasta))
		} else if f.FechaDesde != "" {
			partes = append(partes, fmt.Sprintf("Desde %s", f.FechaDesde))
		} else if f.FechaHasta != "" {
			partes = append(partes, fmt.Sprintf("Hasta %s", f.FechaHasta))
		}
	}

	if f.Sede != "" {
		partes = append(partes, "Sede: "+f.Sede)
	}
	if f.Estado != "" {
		partes = append(partes, "Estado: "+strings.ReplaceAll(f.Estado, "_", " "))
	}
	if f.Busqueda != "" {
		partes = append(partes, "Busqueda: \""+f.Busqueda+"\"")
	}

	if len(partes) == 0 {
		partes = append(partes, "Todo el historial")
	}

	return strings.Join(partes, "  |  ")
}

func (s *ExportarPDFServicio) dibujarPiePagina(pdf *fpdf.Fpdf, tr func(string) string) {
	pdf.SetY(-12)
	pdf.SetFont("Arial", "I", 7)
	pdf.SetTextColor(150, 150, 150)

	pdf.CellFormat(0, 5, tr("Documento confidencial - Solo para uso interno"), "", 0, "L", false, 0, "")
	pdf.CellFormat(0, 5, fmt.Sprintf("Pag %d/{nb}", pdf.PageNo()), "", 0, "R", false, 0, "")
}

// ── Configuración de columnas ──

type colPDF struct {
	titulo string
	ancho  float64
	align  string // L, C, R
}

func (s *ExportarPDFServicio) columnas() []colPDF {
	// A4 landscape = 297mm, margen 10mm cada lado → 277mm disponibles
	return []colPDF{
		{"Codigo", 24, "L"},
		{"Consumidor", 36, "L"},
		{"Documento", 24, "C"},
		{"Tel/Email", 36, "L"},
		{"Tipo", 16, "C"},
		{"Estado", 20, "C"},
		{"Sede", 28, "L"},
		{"Detalle", 40, "L"},
		{"Atendido por", 25, "L"},
		{"Fecha", 18, "C"},
		{"Monto", 18, "R"},
		{"Canal", 16, "C"},
	}
	// Total: 24+36+24+36+16+20+28+40+25+18+18+16 = 301 → ajustar si necesario
	// Realmente usamos: 277mm → redistribuir
}

func (s *ExportarPDFServicio) columnasOptimizadas() []colPDF {
	// 277mm disponibles
	return []colPDF{
		{"Codigo", 32, "L"},
		{"Consumidor", 30, "L"},
		{"Documento", 22, "C"},
		{"Telefono / Email", 30, "L"},
		{"Tipo", 14, "C"},
		{"Estado", 19, "C"},
		{"Sede", 24, "L"},
		{"Detalle", 34, "L"},
		{"Atendido por", 22, "L"},
		{"Fecha", 17, "C"},
		{"Monto (S/)", 16, "R"},
		{"Canal", 17, "C"},
	}
	// Total: 32+30+22+30+14+19+24+34+22+17+16+17 = 277
}

func (s *ExportarPDFServicio) dibujarEncabezadoTabla(pdf *fpdf.Fpdf, tr func(string) string, cols []colPDF) {
	pdf.SetFont("Arial", "B", 7)
	pdf.SetFillColor(26, 86, 219)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetDrawColor(26, 86, 219)

	for _, col := range cols {
		pdf.CellFormat(col.ancho, 7, tr(col.titulo), "1", 0, "C", true, 0, "")
	}
	pdf.Ln(-1)
}

func (s *ExportarPDFServicio) dibujarTablaReclamos(pdf *fpdf.Fpdf, tr func(string) string, reclamos []model.Reclamo) {
	pdf.AliasNbPages("")

	cols := s.columnasOptimizadas()
	s.dibujarEncabezadoTabla(pdf, tr, cols)

	alternar := false
	lineH := 4.2

	for _, rec := range reclamos {
		// Preparar datos de cada celda
		sede := obtenerTextoNulo(rec.SedeNombre)
		if sede == "" {
			sede = "Principal"
		}
		monto := ""
		if rec.MontoReclamado.Valid && rec.MontoReclamado.Float64 > 0 {
			monto = fmt.Sprintf("%.2f", rec.MontoReclamado.Float64)
		}
		fecha := rec.FechaRegistro.Format("02/01/2006")
		estado := formatearEstadoPDF(rec.Estado)

		contacto := rec.Telefono
		if rec.Email != "" {
			if contacto != "" {
				contacto += " / "
			}
			contacto += rec.Email
		}

		detalle := rec.DetalleReclamo
		if detalle == "" && rec.DescripcionSituacion.Valid {
			detalle = rec.DescripcionSituacion.String
		}

		atendidoPor := rec.NombreAtendidoPor
		if atendidoPor == "" {
			atendidoPor = "-"
		}

		canal := rec.CanalOrigen
		if canal == "" {
			canal = "-"
		}

		// Datos de las celdas
		celdas := []string{
			rec.CodigoReclamo,
			rec.NombreCompleto,
			rec.NumeroDocumento,
			contacto,
			rec.TipoSolicitud,
			estado,
			sede,
			detalle,
			atendidoPor,
			fecha,
			monto,
			canal,
		}

		// Columnas que NO deben wrapearse (una sola línea)
		noWrap := map[int]bool{0: true, 2: true, 4: true, 5: true, 9: true, 10: true, 11: true}

		// Calcular altura máxima de la fila (solo por columnas que sí wrapean)
		alturaFila := lineH
		for i, texto := range celdas {
			if noWrap[i] {
				continue
			}
			textoTr := tr(texto)
			lines := pdf.SplitText(textoTr, cols[i].ancho-2)
			h := float64(len(lines)) * lineH
			if h > alturaFila {
				alturaFila = h
			}
		}
		alturaFila = math.Max(alturaFila, 6.5)

		// Verificar salto de página
		if pdf.GetY()+alturaFila > 195 {
			pdf.AddPage()
			s.dibujarEncabezadoTabla(pdf, tr, cols)
		}

		// Color de fondo alterno
		if alternar {
			pdf.SetFillColor(245, 247, 252)
		} else {
			pdf.SetFillColor(255, 255, 255)
		}
		alternar = !alternar

		yInicio := pdf.GetY()
		xInicio := pdf.GetX()

		// Dibujar fondo de toda la fila
		anchoTotal := 0.0
		for _, col := range cols {
			anchoTotal += col.ancho
		}
		pdf.Rect(xInicio, yInicio, anchoTotal, alturaFila, "F")

		// Dibujar bordes de toda la fila
		pdf.SetDrawColor(220, 225, 235)
		pdf.SetLineWidth(0.1)
		x := xInicio
		for _, col := range cols {
			pdf.Rect(x, yInicio, col.ancho, alturaFila, "D")
			x += col.ancho
		}

		// Dibujar contenido de cada celda
		pdf.SetFont("Arial", "", 6.5)
		pdf.SetTextColor(45, 55, 72)
		x = xInicio
		for i, texto := range celdas {
			textoTr := tr(texto)
			col := cols[i]

			if noWrap[i] {
				// Columnas de una sola línea: centrar verticalmente
				yOffset := (alturaFila - lineH) / 2
				if yOffset < 0.5 {
					yOffset = 0.5
				}
				pdf.SetXY(x+1, yInicio+yOffset)
				pdf.CellFormat(col.ancho-2, lineH, textoTr, "", 0, col.align, false, 0, "")
			} else {
				// Columnas que wrapean: MultiCell
				lines := pdf.SplitText(textoTr, col.ancho-2)
				hTexto := float64(len(lines)) * lineH
				yOffset := (alturaFila - hTexto) / 2
				if yOffset < 0.5 {
					yOffset = 0.5
				}
				pdf.SetXY(x+1, yInicio+yOffset)
				pdf.MultiCell(col.ancho-2, lineH, textoTr, "", col.align, false)
			}
			x += col.ancho
		}

		pdf.SetXY(xInicio, yInicio+alturaFila)
	}

	// ── Resumen estadístico ──
	s.dibujarResumen(pdf, tr, reclamos)
}

func (s *ExportarPDFServicio) dibujarResumen(pdf *fpdf.Fpdf, tr func(string) string, reclamos []model.Reclamo) {
	// Salto de página si no hay espacio
	if pdf.GetY()+35 > 195 {
		pdf.AddPage()
	}

	pdf.Ln(6)

	ancho, _ := pdf.GetPageSize()
	mL := 10.0
	w := ancho - mL*2

	// Barra de título del resumen
	pdf.SetFillColor(26, 86, 219)
	pdf.Rect(mL, pdf.GetY(), w, 7, "F")
	pdf.SetXY(mL, pdf.GetY()+0.5)
	pdf.SetFont("Arial", "B", 9)
	pdf.SetTextColor(255, 255, 255)
	pdf.CellFormat(w, 6, tr("  Resumen del Reporte"), "", 1, "L", false, 0, "")
	pdf.Ln(2)

	// Contar estadísticas
	total := len(reclamos)
	pendientes, enProceso, resueltos, cerrados := 0, 0, 0, 0
	reclamos_, quejas := 0, 0
	var montoTotal float64

	for _, rec := range reclamos {
		switch rec.Estado {
		case "PENDIENTE":
			pendientes++
		case "EN_PROCESO":
			enProceso++
		case "RESUELTO":
			resueltos++
		case "CERRADO":
			cerrados++
		}
		if rec.TipoSolicitud == "RECLAMO" {
			reclamos_++
		} else {
			quejas++
		}
		if rec.MontoReclamado.Valid {
			montoTotal += rec.MontoReclamado.Float64
		}
	}

	pdf.SetFont("Arial", "", 8)
	pdf.SetTextColor(55, 65, 81)

	colAncho := w / 4

	// Fila 1: Totales
	pdf.SetX(mL)
	s.celdaResumen(pdf, tr, colAncho, "Total Registros", fmt.Sprintf("%d", total))
	s.celdaResumen(pdf, tr, colAncho, "Reclamos", fmt.Sprintf("%d", reclamos_))
	s.celdaResumen(pdf, tr, colAncho, "Quejas", fmt.Sprintf("%d", quejas))
	s.celdaResumen(pdf, tr, colAncho, "Monto Total", fmt.Sprintf("S/ %.2f", montoTotal))
	pdf.Ln(-1)

	// Fila 2: Por estado
	pdf.SetX(mL)
	s.celdaResumen(pdf, tr, colAncho, "Pendientes", fmt.Sprintf("%d", pendientes))
	s.celdaResumen(pdf, tr, colAncho, "En Proceso", fmt.Sprintf("%d", enProceso))
	s.celdaResumen(pdf, tr, colAncho, "Resueltos", fmt.Sprintf("%d", resueltos))
	s.celdaResumen(pdf, tr, colAncho, "Cerrados", fmt.Sprintf("%d", cerrados))
	pdf.Ln(-1)
}

func (s *ExportarPDFServicio) celdaResumen(pdf *fpdf.Fpdf, tr func(string) string, ancho float64, etiqueta, valor string) {
	pdf.SetFillColor(248, 250, 252)
	pdf.SetDrawColor(230, 232, 240)

	pdf.SetFont("Arial", "", 7)
	pdf.SetTextColor(120, 120, 120)
	pdf.CellFormat(ancho*0.55, 7, tr("  "+etiqueta+":"), "LTB", 0, "L", true, 0, "")

	pdf.SetFont("Arial", "B", 8)
	pdf.SetTextColor(26, 86, 219)
	pdf.CellFormat(ancho*0.45, 7, tr(valor+"  "), "RTB", 0, "R", true, 0, "")
}

func formatearEstadoPDF(estado string) string {
	return strings.ReplaceAll(estado, "_", " ")
}

func obtenerTextoNulo(ns model.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}

func truncar(texto string, max int) string {
	if len(texto) > max {
		return texto[:max] + "..."
	}
	return texto
}
