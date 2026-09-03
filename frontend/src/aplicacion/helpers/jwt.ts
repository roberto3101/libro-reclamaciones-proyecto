interface PayloadJWT {
  sub: string;
  tenant_id: string;
  rol: string;
  exp: number;
  iat: number;
}

export function decodificarToken(token: string): PayloadJWT | null {
  try {
    const partes = token.split('.');
    if (partes.length !== 3) return null;
    const payload = JSON.parse(atob(partes[1]));
    return payload as PayloadJWT;
  } catch {
    return null;
  }
}

export function tokenExpirado(token: string): boolean {
  const payload = decodificarToken(token);
  if (!payload) return true;
  return Date.now() >= payload.exp * 1000;
}

export function tiempoRestanteToken(token: string): number {
  const payload = decodificarToken(token);
  if (!payload) return 0;
  return Math.max(0, payload.exp * 1000 - Date.now());
}
