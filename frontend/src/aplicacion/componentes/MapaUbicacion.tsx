import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix para el ícono por defecto de Leaflet (no carga en bundlers como Vite)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// ── Tipos ──

interface Coordenadas {
  lat: number;
  lng: number;
}

export interface DatosDireccion {
  departamento: string;
  provincia: string;
  distrito: string;
  direccion: string;
}

interface Props {
  latitud?: number | null;
  longitud?: number | null;
  alCambiar?: (lat: number, lng: number) => void;
  alCambiarDireccion?: (datos: DatosDireccion) => void;
  editable?: boolean;
  altura?: number;
  nombreSede?: string;
}

interface ResultadoBusqueda {
  display_name: string;
  lat: string;
  lon: string;
}

// Perú como centro default
const CENTRO_DEFAULT: Coordenadas = { lat: -12.0464, lng: -77.0428 };
const ZOOM_DEFAULT = 13;
const ZOOM_CON_PIN = 16;
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

// ── Subcomponentes internos ──

function ClickHandler({ alCambiar }: { alCambiar: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      alCambiar(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function CentrarMapa({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], zoom, { duration: 0.8 });
  }, [lat, lng, zoom, map]);
  return null;
}

// ── Componente principal ──

export default function MapaUbicacion({
  latitud,
  longitud,
  alCambiar,
  alCambiarDireccion,
  editable = true,
  altura = 300,
  nombreSede,
}: Props) {
  const [posicion, setPosicion] = useState<Coordenadas | null>(
    latitud && longitud ? { lat: latitud, lng: longitud } : null,
  );
  const [detectandoGPS, setDetectandoGPS] = useState(false);

  // Búsqueda de dirección
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const contenedorBusquedaRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  // Sincronizar props → estado local
  useEffect(() => {
    if (latitud && longitud) {
      setPosicion({ lat: latitud, lng: longitud });
    }
  }, [latitud, longitud]);

  // Cerrar resultados al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contenedorBusquedaRef.current && !contenedorBusquedaRef.current.contains(e.target as Node)) {
        setMostrarResultados(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const redondear = (n: number) => Math.round(n * 10000000) / 10000000;

  // ── Geocodificación inversa con Nominatim ──
  const geocodificarInverso = useCallback(async (lat: number, lng: number) => {
    if (!alCambiarDireccion) return;
    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lng),
        format: 'json',
        addressdetails: '1',
      });
      const res = await fetch(`${NOMINATIM_REVERSE_URL}?${params}`, {
        headers: { 'Accept-Language': 'es' },
      });
      if (!res.ok) return;
      const data = await res.json();
      const a = data.address || {};
      alCambiarDireccion({
        departamento: a.state || '',
        provincia: a.county || a.city || a.state_district || '',
        distrito: a.city_district || a.suburb || a.town || a.village || '',
        direccion: [a.road, a.house_number].filter(Boolean).join(' ') || '',
      });
    } catch {
      // Silenciar errores de red — los campos quedan sin autocompletar
    }
  }, [alCambiarDireccion]);

  const manejarClick = (lat: number, lng: number) => {
    if (!editable) return;
    const coords = { lat: redondear(lat), lng: redondear(lng) };
    setPosicion(coords);
    alCambiar?.(coords.lat, coords.lng);
    geocodificarInverso(coords.lat, coords.lng);
  };

  // ── Búsqueda de dirección con Nominatim ──
  const buscarDireccion = useCallback(async (texto: string) => {
    if (texto.trim().length < 3) {
      setResultados([]);
      setMostrarResultados(false);
      return;
    }
    setBuscando(true);
    try {
      const params = new URLSearchParams({
        format: 'json',
        q: texto,
        limit: '5',
        countrycodes: 'pe',
        addressdetails: '1',
      });
      const res = await fetch(`${NOMINATIM_SEARCH_URL}?${params}`, {
        headers: { 'Accept-Language': 'es' },
      });
      if (!res.ok) throw new Error('Error en la búsqueda');
      const data: ResultadoBusqueda[] = await res.json();
      setResultados(data);
      setMostrarResultados(data.length > 0);
    } catch {
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  }, []);

  const handleBusquedaChange = (valor: string) => {
    setBusqueda(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscarDireccion(valor), 400);
  };

  const seleccionarResultado = (r: ResultadoBusqueda) => {
    const lat = redondear(parseFloat(r.lat));
    const lng = redondear(parseFloat(r.lon));
    setPosicion({ lat, lng });
    alCambiar?.(lat, lng);
    geocodificarInverso(lat, lng);
    setBusqueda(r.display_name.split(',').slice(0, 2).join(','));
    setMostrarResultados(false);
  };

  // ── Geolocalización ──
  const detectarUbicacion = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización');
      return;
    }
    setDetectandoGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = redondear(pos.coords.latitude);
        const lng = redondear(pos.coords.longitude);
        setPosicion({ lat, lng });
        alCambiar?.(lat, lng);
        geocodificarInverso(lat, lng);
        setDetectandoGPS(false);
      },
      (err) => {
        console.error('Error GPS:', err);
        const mensajes: Record<number, string> = {
          1: 'Permiso de ubicación denegado. Actívalo en la configuración del navegador.',
          2: 'No se pudo determinar la ubicación. Intenta de nuevo.',
          3: 'Tiempo de espera agotado. Verifica tu conexión.',
        };
        alert(mensajes[err.code] || 'No se pudo obtener la ubicación.');
        setDetectandoGPS(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const centro = posicion || CENTRO_DEFAULT;
  const zoom = posicion ? ZOOM_CON_PIN : ZOOM_DEFAULT;

  return (
    <div className="relative">
      {/* Buscador de dirección (solo editable) */}
      {editable && (
        <div ref={contenedorBusquedaRef} className="relative mb-2">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 dark:text-gray-400 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => handleBusquedaChange(e.target.value)}
              onFocus={() => resultados.length > 0 && setMostrarResultados(true)}
              placeholder="Buscar dirección... (ej: Av. Larco, Miraflores)"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 outline-none transition-shadow"
            />
            {buscando && (
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
          </div>

          {/* Resultados de búsqueda */}
          {mostrarResultados && resultados.length > 0 && (
            <ul className="absolute z-[1000] mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {resultados.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => seleccionarResultado(r)}
                    className="w-full text-left px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-start gap-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                  >
                    <svg className="w-4 h-4 mt-0.5 text-gray-600 dark:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="line-clamp-2">{r.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Mapa */}
      <div
        className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600"
        style={{ height: altura }}
      >
        <MapContainer
          center={[centro.lat, centro.lng]}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
          scrollWheelZoom={editable}
          dragging={true}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {posicion && <Marker position={[posicion.lat, posicion.lng]} />}
          {editable && <ClickHandler alCambiar={manejarClick} />}
          {posicion && <CentrarMapa lat={posicion.lat} lng={posicion.lng} zoom={zoom} />}
        </MapContainer>
      </div>

      {/* Controles (solo en modo editable) */}
      {editable && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <button
            type="button"
            onClick={detectarUbicacion}
            disabled={detectandoGPS}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-50 disabled:cursor-wait transition-colors"
          >
            {detectandoGPS ? (
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth="3" opacity="0.25" />
                <path d="M4 12a8 8 0 018-8" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
            {detectandoGPS ? 'Detectando...' : 'Mi ubicación'}
          </button>

          {posicion && (
            <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">
              {posicion.lat}, {posicion.lng}
            </span>
          )}

          {!posicion && (
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Haz click en el mapa o busca una dirección
            </span>
          )}
        </div>
      )}

      {/* Info read-only (libro público) */}
      {!editable && nombreSede && (
        <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400 text-center">
          {nombreSede}
        </p>
      )}
    </div>
  );
}
