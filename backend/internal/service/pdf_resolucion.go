package service

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"strings"

	"github.com/jung-kurt/gofpdf"
)

// sanitizarTextoPDF reemplaza caracteres acentuados y especiales que causan panic en gofpdf.
func sanitizarTextoPDF(s string) string {
	r := strings.NewReplacer(
		"á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u",
		"Á", "A", "É", "E", "Í", "I", "Ó", "O", "Ú", "U",
		"ñ", "n", "Ñ", "N",
		"ü", "u", "Ü", "U",
		"¿", "?", "¡", "!",
		"°", "o", "º", "o", "ª", "a",
		"\u00a0", " ",
		"\u2013", "-", "\u2014", "-",
		"\u201c", "\"", "\u201d", "\"", "\u2018", "'", "\u2019", "'",
	)
	return r.Replace(s)
}

// DatosResolucionPDF contiene todos los datos necesarios para generar el PDF.
type DatosResolucionPDF struct {
	Codigo string
	Fecha  string // formato DD/MM/YYYY

	// Proveedor
	RazonSocial     string
	NombreComercial string
	RUC             string
	Sede            string
	DireccionSede   string

	// Consumidor
	NombreCliente    string
	TipoDoc          string
	NumDoc           string
	DomicilioCliente string
	TelefonoCliente  string
	EmailCliente     string

	// Reclamo
	DetalleReclamo   string
	PedidoConsumidor string

	// Resolucion
	RespuestaTexto string
	AccionTomada   string

	// Firma del representante (base64 data URL)
	FirmaBase64 string

	// Color primario del tenant (hex, ej: "#1a3faa")
	ColorPrimario string
}

type coloresPDF struct {
	pR, pG, pB          int // primario
	pLightR, pLightG, pLightB int // primario suave (headers seccion)
	pVeryLightR, pVeryLightG, pVeryLightB int // primario muy suave (fondo alterno)
}

func calcColores(hex string) coloresPDF {
	c := coloresPDF{
		pR: 25, pG: 55, pB: 150,
	}
	if len(hex) == 7 && hex[0] == '#' {
		fmt.Sscanf(hex, "#%02x%02x%02x", &c.pR, &c.pG, &c.pB)
	}
	// Version suave para headers de seccion (mezcla con blanco 70%)
	c.pLightR = c.pR + (255-c.pR)*70/100
	c.pLightG = c.pG + (255-c.pG)*70/100
	c.pLightB = c.pB + (255-c.pB)*70/100
	// Version muy suave para filas alternas
	c.pVeryLightR = c.pR + (255-c.pR)*92/100
	c.pVeryLightG = c.pG + (255-c.pG)*92/100
	c.pVeryLightB = c.pB + (255-c.pB)*92/100
	return c
}

func maxI(a, b int) int { if a > b { return a }; return b }
func minI(a, b int) int { if a < b { return a }; return b }

// GenerarPDFResolucion genera el PDF de resolucion con formato profesional.
func GenerarPDFResolucion(datos DatosResolucionPDF) ([]byte, error) {
	// Sanitizar
	datos.Codigo = sanitizarTextoPDF(datos.Codigo)
	datos.Fecha = sanitizarTextoPDF(datos.Fecha)
	datos.RazonSocial = sanitizarTextoPDF(datos.RazonSocial)
	datos.NombreComercial = sanitizarTextoPDF(datos.NombreComercial)
	datos.RUC = sanitizarTextoPDF(datos.RUC)
	datos.Sede = sanitizarTextoPDF(datos.Sede)
	datos.DireccionSede = sanitizarTextoPDF(datos.DireccionSede)
	datos.NombreCliente = sanitizarTextoPDF(datos.NombreCliente)
	datos.TipoDoc = sanitizarTextoPDF(datos.TipoDoc)
	datos.NumDoc = sanitizarTextoPDF(datos.NumDoc)
	datos.DomicilioCliente = sanitizarTextoPDF(datos.DomicilioCliente)
	datos.TelefonoCliente = sanitizarTextoPDF(datos.TelefonoCliente)
	datos.EmailCliente = sanitizarTextoPDF(datos.EmailCliente)
	datos.DetalleReclamo = sanitizarTextoPDF(datos.DetalleReclamo)
	datos.PedidoConsumidor = sanitizarTextoPDF(datos.PedidoConsumidor)
	datos.RespuestaTexto = sanitizarTextoPDF(datos.RespuestaTexto)
	datos.AccionTomada = sanitizarTextoPDF(datos.AccionTomada)

	nombreEmpresa := datos.NombreComercial
	if nombreEmpresa == "" {
		nombreEmpresa = datos.RazonSocial
	}

	col := calcColores(datos.ColorPrimario)

	pdf := gofpdf.New("P", "mm", "A4", "")
	tr := pdf.UnicodeTranslatorFromDescriptor("")
	pdf.SetAutoPageBreak(true, 30)
	pdf.AddPage()

	ancho, _ := pdf.GetPageSize()
	mL := 20.0
	mR := 20.0
	w := ancho - mL - mR

	// ════════════════════════════════════════════════════
	// BARRA SUPERIOR (color primario solido, elegante)
	// ════════════════════════════════════════════════════
	pdf.SetFillColor(col.pR, col.pG, col.pB)
	pdf.Rect(0, 0, ancho, 3, "F")

	// Segunda linea mas fina, version clara
	pdf.SetFillColor(col.pLightR, col.pLightG, col.pLightB)
	pdf.Rect(0, 3, ancho, 1, "F")

	// ════════════════════════════════════════════════════
	// HEADER: Nombre empresa
	// ════════════════════════════════════════════════════
	pdf.SetY(10)
	pdf.SetX(mL)

	// Adaptar tamano de fuente
	nombreTr := tr(nombreEmpresa)
	fs := 17.0
	pdf.SetFont("Arial", "B", fs)
	for pdf.GetStringWidth(nombreTr) > w && fs > 10 {
		fs -= 0.5
		pdf.SetFont("Arial", "B", fs)
	}
	if pdf.GetStringWidth(nombreTr) > w {
		for len(nombreTr) > 5 && pdf.GetStringWidth(nombreTr+"...") > w {
			nombreTr = nombreTr[:len(nombreTr)-1]
		}
		nombreTr = nombreTr + "..."
	}

	pdf.SetTextColor(col.pR, col.pG, col.pB)
	pdf.CellFormat(w, 8, nombreTr, "", 1, "L", false, 0, "")

	// RUC debajo del nombre, mas sutil
	pdf.SetX(mL)
	pdf.SetFont("Arial", "", 9)
	pdf.SetTextColor(130, 130, 130)
	pdf.CellFormat(w, 4, tr("RUC: "+datos.RUC), "", 1, "L", false, 0, "")

	// Linea separadora
	ySep := pdf.GetY() + 2
	pdf.SetDrawColor(col.pR, col.pG, col.pB)
	pdf.SetLineWidth(0.4)
	pdf.Line(mL, ySep, ancho-mR, ySep)
	pdf.SetY(ySep + 5)

	// ════════════════════════════════════════════════════
	// FECHA DE REGISTRO + EXPEDIENTE
	// ════════════════════════════════════════════════════
	pdf.SetX(mL)
	pdf.SetFont("Arial", "", 9)
	pdf.SetTextColor(80, 80, 80)
	pdf.CellFormat(w*0.55, 5, tr("Fecha de Registro: "+formatearFechaLarga(datos.Fecha)), "", 0, "L", false, 0, "")

	pdf.SetFont("Arial", "B", 9)
	pdf.SetTextColor(col.pR, col.pG, col.pB)
	pdf.CellFormat(w*0.45, 5, tr("Expediente: "+datos.Codigo), "", 1, "R", false, 0, "")
	pdf.Ln(5)

	// ════════════════════════════════════════════════════
	// TITULO
	// ════════════════════════════════════════════════════
	pdf.SetX(mL)
	pdf.SetFont("Arial", "B", 18)
	pdf.SetTextColor(40, 40, 40)
	pdf.CellFormat(w, 10, "RESOLUCION", "", 1, "C", false, 0, "")

	// Ornamento: linea centrada con color primario
	centro := ancho / 2
	pdf.SetDrawColor(col.pR, col.pG, col.pB)
	pdf.SetLineWidth(0.6)
	pdf.Line(centro-25, pdf.GetY()+1, centro+25, pdf.GetY()+1)
	pdf.SetLineWidth(0.2)
	pdf.Line(centro-35, pdf.GetY()+3, centro+35, pdf.GetY()+3)
	pdf.Ln(8)

	// ════════════════════════════════════════════════════
	// SECCIONES
	// ════════════════════════════════════════════════════
	dibujarSecV2(pdf, tr, mL, w, col, "1. IDENTIFICACION DEL PROVEEDOR", []filaDato{
		{"Razon Social", datos.RazonSocial},
		{"RUC", datos.RUC},
		{"Sede", datos.Sede},
		{"Direccion", datos.DireccionSede},
	})

	docStr := datos.TipoDoc + " " + datos.NumDoc
	contacto := datos.TelefonoCliente
	if datos.EmailCliente != "" {
		contacto += " / " + datos.EmailCliente
	}
	dibujarSecV2(pdf, tr, mL, w, col, "2. IDENTIFICACION DEL CONSUMIDOR", []filaDato{
		{"Nombre", datos.NombreCliente},
		{"Documento", docStr},
		{"Domicilio", datos.DomicilioCliente},
		{"Contacto", contacto},
	})

	dibujarSecV2(pdf, tr, mL, w, col, "3. DETALLE DEL RECLAMO / QUEJA", []filaDato{
		{"Detalle", datos.DetalleReclamo},
		{"Pedido del consumidor", datos.PedidoConsumidor},
	})

	filas4 := []filaDato{{"Respuesta", datos.RespuestaTexto}}
	if datos.AccionTomada != "" {
		filas4 = append(filas4, filaDato{"Accion adoptada", datos.AccionTomada})
	}
	dibujarSecV2(pdf, tr, mL, w, col, "4. RESOLUCION DE LA EMPRESA", filas4)

	// ════════════════════════════════════════════════════
	// FIRMA
	// ════════════════════════════════════════════════════
	pdf.Ln(10)
	pdf.SetX(mL)
	pdf.SetFont("Arial", "I", 11)
	pdf.SetTextColor(60, 60, 60)
	pdf.CellFormat(w, 6, "Atte.", "", 1, "L", false, 0, "")
	pdf.Ln(2)

	// Firma digital (imagen base64)
	if datos.FirmaBase64 != "" {
		firmaBytes := decodeFirmaBase64(datos.FirmaBase64)
		if firmaBytes != nil {
			imgName := "firma_repr"
			reader := bytes.NewReader(firmaBytes)
			pdf.RegisterImageOptionsReader(imgName, gofpdf.ImageOptions{ImageType: "png"}, reader)
			pdf.ImageOptions(imgName, mL, pdf.GetY(), 45, 22, false, gofpdf.ImageOptions{ImageType: "png"}, 0, "")
			pdf.SetY(pdf.GetY() + 24)
		}
	} else {
		pdf.Ln(16)
	}

	// Linea de firma
	pdf.SetX(mL)
	pdf.SetDrawColor(col.pR, col.pG, col.pB)
	pdf.SetLineWidth(0.3)
	pdf.Line(mL, pdf.GetY(), mL+65, pdf.GetY())
	pdf.Ln(2)

	pdf.SetX(mL)
	pdf.SetFont("Arial", "B", 9)
	pdf.SetTextColor(col.pR, col.pG, col.pB)
	pdf.CellFormat(65, 4, tr(nombreEmpresa), "", 1, "L", false, 0, "")

	pdf.SetX(mL)
	pdf.SetFont("Arial", "", 8)
	pdf.SetTextColor(120, 120, 120)
	pdf.CellFormat(65, 4, tr("RUC: "+datos.RUC), "", 1, "L", false, 0, "")

	// ════════════════════════════════════════════════════
	// PIE DE PAGINA
	// ════════════════════════════════════════════════════
	pdf.SetY(-20)
	pdf.SetDrawColor(col.pR, col.pG, col.pB)
	pdf.SetLineWidth(0.3)
	pdf.Line(mL, pdf.GetY(), ancho-mR, pdf.GetY())
	pdf.Ln(3)

	pdf.SetX(mL)
	pdf.SetFont("Arial", "", 7)
	pdf.SetTextColor(150, 150, 150)
	pdf.CellFormat(w*0.7, 3, tr("Documento emitido conforme a la Ley N 29571 - Codigo de Proteccion y Defensa del Consumidor"), "", 0, "L", false, 0, "")
	pdf.CellFormat(w*0.3, 3, tr("Ref: "+datos.Codigo), "", 1, "R", false, 0, "")

	pdf.SetX(mL)
	pdf.CellFormat(w, 3, tr("Generado automaticamente por el Sistema de Libro de Reclamaciones"), "", 1, "L", false, 0, "")

	// OUTPUT
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("error generando PDF resolucion: %w", err)
	}
	return buf.Bytes(), nil
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type filaDato struct {
	etiqueta string
	valor    string
}

func dibujarSecV2(pdf *gofpdf.Fpdf, tr func(string) string, mL, w float64, col coloresPDF, titulo string, filas []filaDato) {
	anchoEtq := w * 0.28
	anchoVal := w * 0.72

	// Header de seccion: fondo suave con borde izquierdo grueso de color primario
	yH := pdf.GetY()
	pdf.SetFillColor(col.pVeryLightR, col.pVeryLightG, col.pVeryLightB)
	pdf.Rect(mL, yH, w, 7, "F")

	// Barra lateral izquierda de acento
	pdf.SetFillColor(col.pR, col.pG, col.pB)
	pdf.Rect(mL, yH, 2.5, 7, "F")

	pdf.SetXY(mL+6, yH+0.5)
	pdf.SetFont("Arial", "B", 9)
	pdf.SetTextColor(col.pR, col.pG, col.pB)
	pdf.CellFormat(w-8, 6, tr(titulo), "", 1, "L", false, 0, "")

	// Filas
	for i, fila := range filas {
		yInicio := pdf.GetY()
		lineH := 4.5
		valorTr := tr(fila.valor)
		alturaVal := calcAltV2(pdf, anchoVal-6, lineH, valorTr)
		if alturaVal < 6.5 {
			alturaVal = 6.5
		}

		// Salto de pagina si necesario
		_, pageH := pdf.GetPageSize()
		if yInicio+alturaVal > pageH-30 {
			pdf.AddPage()
			yInicio = pdf.GetY()
		}

		// Fondo alterno
		if i%2 == 0 {
			pdf.SetFillColor(252, 252, 255)
		} else {
			pdf.SetFillColor(255, 255, 255)
		}
		pdf.Rect(mL, yInicio, w, alturaVal, "F")

		// Bordes suaves
		pdf.SetDrawColor(230, 232, 238)
		pdf.SetLineWidth(0.15)
		pdf.Line(mL, yInicio+alturaVal, mL+w, yInicio+alturaVal)
		pdf.Line(mL, yInicio, mL, yInicio+alturaVal)
		pdf.Line(mL+w, yInicio, mL+w, yInicio+alturaVal)

		// Etiqueta
		pdf.SetXY(mL+4, yInicio+(alturaVal-4.5)/2)
		pdf.SetFont("Arial", "B", 8)
		pdf.SetTextColor(90, 95, 110)
		pdf.CellFormat(anchoEtq-8, 4.5, tr(fila.etiqueta), "", 0, "L", false, 0, "")

		// Valor
		pdf.SetFont("Arial", "", 8)
		pdf.SetTextColor(35, 35, 35)
		pdf.SetXY(mL+anchoEtq+3, yInicio+1)
		pdf.MultiCell(anchoVal-6, lineH, valorTr, "", "L", false)

		pdf.SetY(yInicio + alturaVal)
	}

	// Linea inferior de seccion
	pdf.SetDrawColor(col.pLightR, col.pLightG, col.pLightB)
	pdf.SetLineWidth(0.3)
	pdf.Line(mL, pdf.GetY(), mL+w, pdf.GetY())

	pdf.Ln(5)
}

func calcAltV2(pdf *gofpdf.Fpdf, ancho, lineHeight float64, texto string) float64 {
	if texto == "" {
		return 6.5
	}
	lines := pdf.SplitText(texto, ancho)
	h := float64(len(lines)) * lineHeight
	if h < 6.5 {
		return 6.5
	}
	return h + 2
}

func decodeFirmaBase64(dataURL string) []byte {
	if !strings.HasPrefix(dataURL, "data:") {
		return nil
	}
	parts := strings.SplitN(dataURL, ",", 2)
	if len(parts) != 2 {
		return nil
	}
	data, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return nil
	}
	return data
}

func formatearFechaLarga(fecha string) string {
	partes := strings.Split(fecha, "/")
	if len(partes) != 3 {
		return fecha
	}
	meses := map[string]string{
		"01": "enero", "02": "febrero", "03": "marzo", "04": "abril",
		"05": "mayo", "06": "junio", "07": "julio", "08": "agosto",
		"09": "septiembre", "10": "octubre", "11": "noviembre", "12": "diciembre",
	}
	mes := meses[partes[1]]
	if mes == "" {
		mes = partes[1]
	}
	return fmt.Sprintf("%s de %s de %s", partes[0], mes, partes[2])
}
