#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Test de errores para la campana del health check de chatbots
#
# Uso:
#   bash test-errores-chatbot.sh              → ciclo completo
#   bash test-errores-chatbot.sh todo-mal     → genera errores
#   bash test-errores-chatbot.sh restaurar    → limpia errores
#   bash test-errores-chatbot.sh desactivar
#   bash test-errores-chatbot.sh activar
#   bash test-errores-chatbot.sh sin-permisos
#   bash test-errores-chatbot.sh con-permisos
# ═══════════════════════════════════════════════════════════════

API="http://localhost:8080/api/v1"
ACCION="${1:-ciclo}"

# ── Credenciales ──
EMAIL="admin@demo.com"
PASSWORD="admin123"

echo "═══ TEST CAMPANA ERRORES ═══"
echo ""

echo "🔐 Iniciando sesión..."
LOGIN_RESP=$(curl -s -X POST -H "Content-Type: application/json" \
  "$API/auth/login" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESP" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login fallido. Verifica email y password."
  echo "   Respuesta: $LOGIN_RESP"
  exit 1
fi

echo "✅ Login exitoso"
echo ""

AUTH="Authorization: Bearer $TOKEN"
CT="Content-Type: application/json"

# ── Obtener primer chatbot ──
echo "🔍 Buscando chatbot..."
CHATBOT_JSON=$(curl -s -H "$AUTH" "$API/chatbots")
CHATBOT_ID=$(echo "$CHATBOT_JSON" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
CHATBOT_NOMBRE=$(echo "$CHATBOT_JSON" | grep -o '"nombre":"[^"]*"' | head -1 | cut -d'"' -f4)
CHATBOT_TIPO=$(echo "$CHATBOT_JSON" | grep -o '"tipo":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$CHATBOT_ID" ]; then
  echo "❌ No se encontró ningún chatbot."
  exit 1
fi

echo "✅ Chatbot: $CHATBOT_NOMBRE ($CHATBOT_ID)"
echo ""

# ── Funciones ──

desactivar_bot() {
  echo "🔴 Desactivando bot..."
  curl -s -X POST -H "$AUTH" "$API/chatbots/$CHATBOT_ID/deactivate" > /dev/null
  echo "   → Error: 'Bot desactivado'"
}

activar_bot() {
  echo "🟢 Activando bot..."
  curl -s -X POST -H "$AUTH" "$API/chatbots/$CHATBOT_ID/reactivate" > /dev/null
  echo "   → Restaurado"
}

quitar_permisos() {
  echo "🔴 Quitando permisos..."
  curl -s -X PUT -H "$AUTH" -H "$CT" "$API/chatbots/$CHATBOT_ID" \
    -d "{\"nombre\":\"$CHATBOT_NOMBRE\",\"tipo\":\"$CHATBOT_TIPO\",\"activo\":true,\"puede_leer_reclamos\":false,\"puede_enviar_mensajes\":false,\"puede_cambiar_estado\":false}" > /dev/null
  echo "   → Error: 'Sin permisos configurados'"
}

restaurar_permisos() {
  echo "🟢 Restaurando permisos..."
  curl -s -X PUT -H "$AUTH" -H "$CT" "$API/chatbots/$CHATBOT_ID" \
    -d "{\"nombre\":\"$CHATBOT_NOMBRE\",\"tipo\":\"$CHATBOT_TIPO\",\"activo\":true,\"puede_leer_reclamos\":true,\"puede_enviar_mensajes\":true,\"puede_cambiar_estado\":true}" > /dev/null
  echo "   → Restaurado"
}

# ── Ejecutar acción ──

case "$ACCION" in
  desactivar)   desactivar_bot ;;
  activar)      activar_bot ;;
  sin-permisos) quitar_permisos ;;
  con-permisos) restaurar_permisos ;;
  todo-mal)
    desactivar_bot
    quitar_permisos
    echo ""
    echo "🔔 La campana debería mostrar 2 errores"
    ;;
  restaurar)
    activar_bot
    restaurar_permisos
    echo ""
    echo "✅ Campana limpia"
    ;;
  ciclo)
    echo "👀 Abre el panel del chatbot y mira la campana..."
    sleep 2

    desactivar_bot
    echo "   ⏳ 5s..."
    sleep 5

    quitar_permisos
    echo "   ⏳ 5s..."
    sleep 5

    echo ""
    echo "🔔 Deberías ver 2 errores en la campana"
    echo "   ⏳ 8s antes de restaurar..."
    sleep 8
    echo ""

    activar_bot
    sleep 3
    restaurar_permisos
    echo "   ⏳ 5s..."
    sleep 5

    echo ""
    echo "✅ Ciclo completo — campana limpia"
    ;;
  *)
    echo "❌ Acción: $ACCION no reconocida"
    echo "   Opciones: desactivar|activar|sin-permisos|con-permisos|todo-mal|restaurar|ciclo"
    exit 1
    ;;
esac

echo ""
echo "═══ FIN ═══"
