type TipoBreadcrumb = 'navegacion' | 'click' | 'api' | 'error';

interface Breadcrumb {
  tipo: TipoBreadcrumb;
  descripcion: string;
  timestamp: string;
  datos?: Record<string, unknown>;
}

const MAX_BREADCRUMBS = 20;

class CapturadorBreadcrumbs {
  private buffer: Breadcrumb[] = [];
  private inicializado = false;

  inicializar(): void {
    if (this.inicializado) return;
    this.inicializado = true;
    this.capturarClicks();
  }

  registrarNavegacion(ruta: string): void {
    this.agregar('navegacion', `Navegó a ${ruta}`);
  }

  registrarClick(elemento: string): void {
    this.agregar('click', `Click en ${elemento}`);
  }

  registrarLlamadaAPI(metodo: string, url: string, status: number): void {
    const rutaCorta = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
    this.agregar('api', `${metodo} ${rutaCorta} → ${status}`, { status });
  }

  registrarError(mensaje: string): void {
    this.agregar('error', mensaje);
  }

  obtenerBreadcrumbs(): Breadcrumb[] {
    return [...this.buffer];
  }

  obtenerBreadcrumbsJSON(): string {
    return JSON.stringify(this.buffer);
  }

  limpiar(): void {
    this.buffer = [];
  }

  private agregar(tipo: TipoBreadcrumb, descripcion: string, datos?: Record<string, unknown>): void {
    this.buffer.push({
      tipo,
      descripcion: descripcion.slice(0, 120),
      timestamp: new Date().toISOString(),
      datos,
    });
    if (this.buffer.length > MAX_BREADCRUMBS) {
      this.buffer = this.buffer.slice(-MAX_BREADCRUMBS);
    }
  }

  private capturarClicks(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const tag = target.tagName?.toLowerCase();
      if (!tag || ['html', 'body', 'div', 'span', 'main', 'section'].includes(tag)) return;

      let texto = target.textContent?.trim()?.slice(0, 30) || '';
      const ariaLabel = target.getAttribute('aria-label');
      if (ariaLabel) texto = ariaLabel.slice(0, 30);

      if (texto) {
        this.registrarClick(`<${tag}> "${texto}"`);
      }
    }, { passive: true, capture: true });
  }
}

export const capturadorBreadcrumbs = new CapturadorBreadcrumbs();
