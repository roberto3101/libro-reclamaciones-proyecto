# ── Backend Go ─────────────────────────────────────────────────────────
# Compilación en dos etapas: la primera trae el compilador y las
# dependencias, la segunda se queda solo con el binario. La imagen final
# pesa unos 30 MB en vez de ~900 MB.

FROM golang:1.25-alpine AS compilacion

WORKDIR /origen

# Las dependencias se copian antes que el código para que Docker reutilice
# la capa mientras go.mod no cambie. Sin esto, cada edición de un .go
# vuelve a descargar todo el árbol de módulos.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# CGO desactivado: produce un binario estático que corre en una imagen
# sin libc. -s -w quitan la tabla de símbolos y la información de depuración.
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /api ./cmd/api


FROM alpine:3.20

# Certificados raíz: sin ellos fallan las llamadas HTTPS salientes (Culqi,
# SMTP, las APIs de IA). Es el fallo más común al pasar a Alpine.
# tzdata: los plazos de INDECOPI se calculan en America/Lima; sin la base
# de zonas horarias el contenedor cuenta en UTC y el plazo sale corrido.
RUN apk add --no-cache ca-certificates tzdata && \
    adduser -D -u 10001 aplicacion

ENV TZ=America/Lima

COPY --from=compilacion /api /usr/local/bin/api
COPY --from=compilacion /origen/migrations /migrations

# No corre como root: si alguien escapa del proceso, no es administrador
# del contenedor.
USER aplicacion

EXPOSE 8080

# El propio backend expone /health, así que Docker sabe si está vivo de
# verdad y no solo si el proceso existe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health | grep -q '"status":"healthy"' || exit 1

ENTRYPOINT ["/usr/local/bin/api"]
