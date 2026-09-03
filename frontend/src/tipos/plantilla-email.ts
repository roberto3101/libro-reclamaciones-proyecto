export interface PlantillaEmail {
  id: string;
  tenant_id: string;
  tipo_evento: string;
  nombre_visual: string;
  asunto: string;
  saludo: string;
  cuerpo_principal: string;
  texto_pie: string;
  texto_boton: string;
  variables_permitidas: string[];
  activa: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface ActualizarPlantillaEmailRequest {
  asunto: string;
  saludo: string;
  cuerpo_principal: string;
  texto_pie: string;
  texto_boton: string;
  activa: boolean;
}

export interface DefinicionPlantillasEmail {
  tipos_evento: Record<string, string>;
  tipos_evento_validos: string[];
  plantillas_por_defecto: PlantillaEmail[];
}
