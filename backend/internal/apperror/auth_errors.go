package apperror

// Errores de autenticación y autorización.
var (
	ErrTokenInvalido = New(401, "TOKEN_INVALID",
		"Token inválido o expirado.")

	ErrTokenRequerido = New(401, "TOKEN_REQUIRED",
		"Se requiere autenticación.")

	ErrCredencialesInvalidas = New(401, "CREDENTIALS_INVALID",
		"Email o contraseña incorrectos.")

	ErrCuentaInactiva = New(403, "ACCOUNT_INACTIVE",
		"Tu cuenta ha sido desactivada. Contacta al administrador.")

	ErrRolInsuficiente = New(403, "INSUFFICIENT_ROLE",
		"No tienes el rol necesario para esta acción.")

	ErrPermisoInsuficiente = New(403, "PERMISO_INSUFICIENTE",
		"No tienes permiso para esta acción.")

	ErrSedeNoPermitida = New(403, "SEDE_NOT_ALLOWED",
		"No tienes acceso a los reclamos de esta sede.")

	// API Keys (chatbots)
	ErrAPIKeyInvalida = New(401, "API_KEY_INVALID",
		"API key inválida o expirada.")

	ErrAPIKeyRequerida = New(401, "API_KEY_REQUIRED",
		"Se requiere API key para este endpoint.")

	ErrAPIKeyIPDenegada = New(403, "API_KEY_IP_DENIED",
		"Tu IP no está en la lista de IPs permitidas de esta API key.")

	ErrAPIKeyScopeInsuficiente = New(403, "API_KEY_SCOPE_DENIED",
		"Tu chatbot no tiene permiso para: %s")

	ErrRateLimitMinuto = New(429, "RATE_LIMIT_MINUTE",
		"Límite de requests por minuto excedido. Espera un momento.")

	ErrRateLimitDia = New(429, "RATE_LIMIT_DAY",
		"Límite de requests diarios excedido.")

	ErrFueraDeHorario = New(403, "OUTSIDE_SCHEDULE",
		"El chatbot solo opera de %s a %s.")
)
