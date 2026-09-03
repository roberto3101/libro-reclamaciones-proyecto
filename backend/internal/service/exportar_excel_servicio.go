package service

import (
	"fmt"
	"strings"

	"libro-reclamaciones/internal/model"

	"github.com/xuri/excelize/v2"
)

type ExportarExcelServicio struct{}

func NuevoExportarExcelServicio() *ExportarExcelServicio {
	return &ExportarExcelServicio{}
}

// GenerarReporteReclamos genera un archivo Excel con la lista de reclamos del tenant.
func (s *ExportarExcelServicio) GenerarReporteReclamos(reclamos []model.Reclamo, nombreEmpresa string) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	hoja := "Reclamos"
	indice, _ := f.NewSheet(hoja)
	f.DeleteSheet("Sheet1")
	f.SetActiveSheet(indice)

	// ── Estilos ──
	estiloEncabezado := s.crearEstiloEncabezado(f)
	estiloMoneda := s.crearEstiloMoneda(f)

	// ── Encabezados ──
	encabezados := []string{
		"Código", "Tipo Solicitud", "Estado", "Consumidor",
		"Tipo Doc.", "Nro. Documento", "Teléfono", "Email",
		"Sede", "Atendido por", "Bien/Servicio", "Descripción Bien",
		"Monto Reclamado", "Fecha Incidente", "Fecha Registro",
		"Fecha Límite", "Canal", "Es Cliente",
	}

	for i, enc := range encabezados {
		celda, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(hoja, celda, enc)
		f.SetCellStyle(hoja, celda, celda, estiloEncabezado)
	}

	// ── Datos ──
	for fila, rec := range reclamos {
		filaExcel := fila + 2 // fila 1 es encabezado

		sede := ""
		if rec.SedeNombre.Valid {
			sede = rec.SedeNombre.String
		}
		tipoBien := ""
		if rec.TipoBien.Valid {
			tipoBien = rec.TipoBien.String
		}
		monto := 0.0
		if rec.MontoReclamado.Valid {
			monto = rec.MontoReclamado.Float64
		}
		fechaIncidente := rec.FechaIncidente.Format("02/01/2006")
		fechaRegistro := rec.FechaRegistro.Format("02/01/2006 15:04")
		fechaLimite := ""
		if rec.FechaLimiteRespuesta.Valid {
			fechaLimite = rec.FechaLimiteRespuesta.Time.Format("02/01/2006")
		}
		estado := strings.ReplaceAll(rec.Estado, "_", " ")

		atendidoPor := rec.NombreAtendidoPor
		if atendidoPor == "" {
			atendidoPor = "-"
		}

		esCliente := "No"
		if rec.EsClienteRegistrado {
			esCliente = "Sí"
		}

		valores := []interface{}{
			rec.CodigoReclamo,
			rec.TipoSolicitud,
			estado,
			rec.NombreCompleto,
			rec.TipoDocumento,
			rec.NumeroDocumento,
			rec.Telefono,
			rec.Email,
			sede,
			atendidoPor,
			tipoBien,
			rec.DescripcionBien,
			monto,
			fechaIncidente,
			fechaRegistro,
			fechaLimite,
			rec.CanalOrigen,
			esCliente,
		}

		for col, val := range valores {
			celda, _ := excelize.CoordinatesToCellName(col+1, filaExcel)
			f.SetCellValue(hoja, celda, val)

			// Estilo moneda para columna Monto
			if col == 12 {
				f.SetCellStyle(hoja, celda, celda, estiloMoneda)
			}
		}
	}

	// ── Anchos de columna ──
	anchosColumna := map[string]float64{
		"A": 20, "B": 14, "C": 14, "D": 28,
		"E": 10, "F": 16, "G": 16, "H": 28,
		"I": 20, "J": 22, "K": 14, "L": 30,
		"M": 14, "N": 14, "O": 18,
		"P": 14, "Q": 12, "R": 12,
	}
	for col, ancho := range anchosColumna {
		f.SetColWidth(hoja, col, col, ancho)
	}

	// ── Filtros automáticos ──
	ultimaColumna, _ := excelize.CoordinatesToCellName(len(encabezados), 1)
	ultimaCelda, _ := excelize.CoordinatesToCellName(len(encabezados), len(reclamos)+1)
	f.AutoFilter(hoja, fmt.Sprintf("A1:%s", ultimaCelda), nil)

	// ── Inmovilizar primera fila ──
	f.SetPanes(hoja, &excelize.Panes{
		Freeze:      true,
		Split:       false,
		XSplit:      0,
		YSplit:      1,
		TopLeftCell: "A2",
		ActivePane:  "bottomLeft",
	})

	// ── Generar bytes ──
	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, fmt.Errorf("exportar_excel: error generando archivo: %w", err)
	}
	_ = ultimaColumna
	return buf.Bytes(), nil
}

func (s *ExportarExcelServicio) crearEstiloEncabezado(f *excelize.File) int {
	estilo, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold:  true,
			Size:  10,
			Color: "#FFFFFF",
		},
		Fill: excelize.Fill{
			Type:    "pattern",
			Color:   []string{"#1A56DB"},
			Pattern: 1,
		},
		Alignment: &excelize.Alignment{
			Horizontal: "center",
			Vertical:   "center",
			WrapText:   true,
		},
		Border: []excelize.Border{
			{Type: "bottom", Color: "#0E3A8E", Style: 2},
		},
	})
	return estilo
}

func (s *ExportarExcelServicio) crearEstiloMoneda(f *excelize.File) int {
	estilo, _ := f.NewStyle(&excelize.Style{
		NumFmt: 4, // #,##0.00
		Alignment: &excelize.Alignment{
			Horizontal: "right",
		},
	})
	return estilo
}