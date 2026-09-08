package router

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

/*
Qué módulos opcionales están realmente disponibles.

Varios módulos —asistente, chatbots, WhatsApp, correo, adjuntos— solo se
montan si tienen credenciales configuradas. Sin ellas, sus rutas ni
siquiera existen.

El menú, en cambio, se arma con los permisos del rol y del plan, que dicen
lo que el usuario PODRÍA usar, no lo que el servidor tiene encendido. Con
esa diferencia, el plan promete asistente, el menú lo muestra, y al entrar
salta un 404: el usuario cree que el sistema está roto cuando en realidad
está sin configurar.

Esta ruta cierra esa brecha. El menú consulta qué hay encendido y esconde
lo demás; el día que se añadan las claves, reaparece solo.

GET /api/v1/capacidades
*/
type Capacidades struct {
	Asistente bool `json:"asistente"`
	Chatbots  bool `json:"chatbots"`
	WhatsApp  bool `json:"whatsapp"`
	Correo    bool `json:"correo"`
	Adjuntos  bool `json:"adjuntos"`
	Cobros    bool `json:"cobros"`
}

// RegisterCapacidadesRoutes monta la consulta. Va con autenticación: no es
// secreta, pero tampoco hace falta contarle a un desconocido qué piezas
// tiene montadas el servidor.
func RegisterCapacidadesRoutes(r *gin.Engine, caps Capacidades, authMw gin.HandlerFunc) {
	r.GET("/api/v1/capacidades", authMw, func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": caps})
	})
}
