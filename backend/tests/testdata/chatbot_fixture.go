package testdata

import (
	"time"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

var (
	TestTenantID  = uuid.MustParse("11111111-1111-1111-1111-111111111111")
	TestUserID    = uuid.MustParse("22222222-2222-2222-2222-222222222222")
	TestChatbotID = uuid.MustParse("33333333-3333-3333-3333-333333333333")
	TestAPIKeyID  = uuid.MustParse("44444444-4444-4444-4444-444444444444")
)

func ChatbotFixture() model.Chatbot {
	return model.Chatbot{
		TenantModel: model.TenantModel{
			TenantID: TestTenantID,
			ID:       TestChatbotID,
		},
		Nombre:              "Bot Test",
		Tipo:                model.ChatbotAsistenteIA,
		PuedeLeerReclamos:   true,
		PuedeResponder:      true,
		PuedeCambiarEstado:  false,
		PuedeEnviarMensajes: true,
		PuedeLeerMetricas:   false,
		Activo:              true,
		Timestamps: model.Timestamps{
			FechaCreacion:      time.Now(),
			FechaActualizacion: time.Now(),
		},
	}
}

func APIKeyFixture() model.APIKey {
	return model.APIKey{
		TenantModel: model.TenantModel{
			TenantID: TestTenantID,
			ID:       TestAPIKeyID,
		},
		ChatbotID:         TestChatbotID,
		Nombre:            "Key Producción",
		KeyPrefix:         "crb_LIVE_abc",
		KeyHash:           "fakehash1234567890abcdef1234567890abcdef1234567890abcdef12345678",
		Entorno:           model.EntornoLive,
		Activa:            true,
		RequestsPorMinuto: 60,
		RequestsPorDia:    5000,
		FechaCreacion:     time.Now(),
		CreadoPor:         model.NullUUID{UUID: TestUserID, Valid: true},
	}
}

func ChatbotLogFixture() model.ChatbotLog {
	return model.ChatbotLog{
		TenantModel: model.TenantModel{TenantID: TestTenantID},
		ChatbotID:   TestChatbotID,
		APIKeyID:    TestAPIKeyID,
		Metodo:      "GET",
		Endpoint:    "/api/bot/v1/reclamos",
		StatusCode:  200,
		IPAddress:   model.NullString{String: "192.168.1.1", Valid: true},
		DuracionMS:  model.NullInt64{Int64: 45, Valid: true},
		Fecha:       time.Now(),
	}
}