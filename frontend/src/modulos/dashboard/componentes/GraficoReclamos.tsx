import { UiBarChart } from '@/ui/graficos/BarChart';
import { UiTarjeta } from '@/ui';

export function GraficoReclamos() {
  return (
    <UiTarjeta titulo="Reclamos por Mes">
      <UiBarChart
        title=""
        height={320}
        series={[
          { data: [12, 19, 8, 15, 22, 10], label: 'Reclamos' },
          { data: [3, 7, 2, 5, 8, 4], label: 'Quejas' },
        ]}
        xAxis={[{ data: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'], scaleType: 'band' }]}
      />
    </UiTarjeta>
  );
}