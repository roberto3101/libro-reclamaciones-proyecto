package controller

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"net/smtp"
	"strings"
	"time"

	"libro-reclamaciones/internal/config"
	"libro-reclamaciones/internal/helper"

	"github.com/gin-gonic/gin"
)

type ContactoController struct {
	smtpCfg        config.SMTPConfig
	emailDestinoWA string
}

func NewContactoController(smtpCfg config.SMTPConfig, app config.AppConfig) *ContactoController {
	return &ContactoController{
		smtpCfg: smtpCfg,
		// Buzon que recibe las solicitudes de activacion de WhatsApp. Se
		// configura con APP_EMAIL_SOPORTE; vacio deja la funcion inactiva.
		emailDestinoWA: app.EmailSoporte,
	}
}

// EnviarSolicitudWhatsApp envía la solicitud de activación de WhatsApp Business.
// POST /api/v1/contacto/solicitud-whatsapp
func (c *ContactoController) EnviarSolicitudWhatsApp(ctx *gin.Context) {
	var req struct {
		Negocio          string `json:"negocio" binding:"required"`
		RUC              string `json:"ruc" binding:"required"`
		Celular          string `json:"celular" binding:"required"`
		TelefonoContacto string `json:"telefono_contacto" binding:"required"`
		Direccion        string `json:"direccion"`
		Correo           string `json:"correo" binding:"required,email"`
		Horario          string `json:"horario"`
		// Datos internos del tenant (para identificación interna)
		TenantID          string `json:"tenant_id"`
		TenantRazonSocial string `json:"tenant_razon_social"`
		TenantRUC         string `json:"tenant_ruc"`
		TenantSlug        string `json:"tenant_slug"`
		TenantEmail       string `json:"tenant_email"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "detalle": err.Error()})
		return
	}

	// Obtener nombre del usuario autenticado para contexto
	tenantID, _ := helper.GetTenantID(ctx)

	asunto := fmt.Sprintf("Solicitud de activación WhatsApp Business - %s", req.Negocio)

	var cuerpo strings.Builder
	cuerpo.WriteString("<html><body style='font-family:Arial,sans-serif;color:#333'>")
	cuerpo.WriteString("<h2 style='color:#6d28d9'>Solicitud de Activación WhatsApp Business</h2>")
	cuerpo.WriteString("<table style='border-collapse:collapse;width:100%;max-width:500px'>")

	campos := []struct{ label, valor string }{
		{"Nombre del negocio", req.Negocio},
		{"RUC", req.RUC},
		{"Celular dedicado para WhatsApp", req.Celular},
		{"Número de contacto", req.TelefonoContacto},
		{"Dirección", req.Direccion},
		{"Correo de contacto", req.Correo},
		{"Horario de atención", req.Horario},
	}

	for _, campo := range campos {
		if campo.valor == "" {
			continue
		}
		cuerpo.WriteString(fmt.Sprintf(
			"<tr><td style='padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;color:#555;width:180px'>%s</td>"+
				"<td style='padding:8px 12px;border-bottom:1px solid #eee'>%s</td></tr>",
			campo.label, campo.valor,
		))
	}

	cuerpo.WriteString("</table>")

	// Sección interna de identificación del tenant (solo visible para el equipo)
	cuerpo.WriteString("<hr style='margin:20px 0;border:none;border-top:1px solid #e5e7eb'>")
	cuerpo.WriteString("<p style='font-size:11px;color:#9ca3af;margin-bottom:6px;font-weight:600'>DATOS INTERNOS DE IDENTIFICACIÓN</p>")
	cuerpo.WriteString("<table style='border-collapse:collapse;width:100%;max-width:500px;font-size:12px;color:#6b7280'>")

	datosInternos := []struct{ label, valor string }{
		{"Tenant ID", tenantID.String()},
		{"Razón social (sistema)", req.TenantRazonSocial},
		{"RUC (sistema)", req.TenantRUC},
		{"Slug", req.TenantSlug},
		{"Email (sistema)", req.TenantEmail},
	}

	for _, d := range datosInternos {
		if d.valor == "" || d.valor == "00000000-0000-0000-0000-000000000000" {
			continue
		}
		cuerpo.WriteString(fmt.Sprintf(
			"<tr><td style='padding:4px 8px;font-weight:600'>%s</td><td style='padding:4px 8px'>%s</td></tr>",
			d.label, d.valor,
		))
	}

	cuerpo.WriteString("</table>")
	cuerpo.WriteString("</body></html>")

	err := c.enviarEmail(c.emailDestinoWA, req.Correo, asunto, cuerpo.String())
	if err != nil {
		fmt.Printf("[Contacto] ❌ Error enviando solicitud WhatsApp: %v\n", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo enviar la solicitud. Intente nuevamente."})
		return
	}

	fmt.Printf("[Contacto] ✅ Solicitud WhatsApp enviada para %s (RUC: %s)\n", req.Negocio, req.RUC)
	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"mensaje": "Solicitud enviada exitosamente"},
	})
}

// enviarEmail envía un correo HTML simple con Reply-To personalizado.
func (c *ContactoController) enviarEmail(para, replyTo, asunto, cuerpoHTML string) error {
	addr := fmt.Sprintf("%s:%d", c.smtpCfg.Host, c.smtpCfg.Port)

	var msg strings.Builder
	msg.WriteString("From: \"Libro de Reclamaciones\" <" + c.smtpCfg.From + ">\r\n")
	msg.WriteString("To: " + para + "\r\n")
	msg.WriteString("Reply-To: " + replyTo + "\r\n")
	msg.WriteString("Subject: " + asunto + "\r\n")
	msg.WriteString("Date: " + time.Now().Format(time.RFC1123Z) + "\r\n")
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString("Content-Type: text/html; charset=\"UTF-8\"\r\n")
	msg.WriteString("\r\n")
	msg.WriteString(cuerpoHTML)

	// TLS directo (puerto 465)
	tlsConfig := &tls.Config{ServerName: c.smtpCfg.Host}
	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("tls.Dial: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, c.smtpCfg.Host)
	if err != nil {
		return fmt.Errorf("smtp.NewClient: %w", err)
	}
	defer client.Close()

	auth := smtp.PlainAuth("", c.smtpCfg.User, c.smtpCfg.Pass, c.smtpCfg.Host)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("auth: %w", err)
	}
	if err := client.Mail(c.smtpCfg.From); err != nil {
		return fmt.Errorf("mail: %w", err)
	}
	if err := client.Rcpt(para); err != nil {
		return fmt.Errorf("rcpt: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("data: %w", err)
	}
	if _, err := w.Write([]byte(msg.String())); err != nil {
		return fmt.Errorf("write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("close: %w", err)
	}

	return client.Quit()
}
