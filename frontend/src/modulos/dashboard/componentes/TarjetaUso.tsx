import { UiTarjeta, UiProgreso, UiIcono } from '@/ui';
import { UiPila } from '@/ui';

interface Props {
  titulo: string;
  valor: number;
  limite: number;
  /** Nombre de la ligadura en Material Symbols, p. ej. 'mail'. */
  icono: string;
}

export function TarjetaUso({ titulo, valor, limite, icono }: Props) {
  const porcentaje = limite > 0 ? Math.round((valor / limite) * 100) : 0;
  const variante = porcentaje >= 90 ? 'error' as const : porcentaje >= 70 ? 'advertencia' as const : 'primario' as const;

  return (
    <UiTarjeta efectoHover>
      <UiPila direccion="columna" espaciado={1}>
        <UiPila direccion="fila" espaciado={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--ui-texto-2)' }}>{titulo}</span>
          <UiIcono nombre={icono} tamano={20} sx={{ color: 'var(--ui-texto-3)' }} />
        </UiPila>
        <span style={{ fontSize: '2rem', fontWeight: 700 }}>
          {valor} <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--ui-texto-3)' }}>/ {limite}</span>
        </span>
        <UiProgreso valor={porcentaje} variante={variante} tamano="sm" />
      </UiPila>
    </UiTarjeta>
  );
}