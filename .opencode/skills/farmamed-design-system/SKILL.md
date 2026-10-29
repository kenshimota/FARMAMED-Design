---
name: farmamed-design-system
description: Use when designing or implementing Farmamed UI, Spanish copy, brand colors, typography, spacing, accessibility, responsive layouts, motion, or visual consistency. Covers DESIGN.md, app/globals.css tokens, component patterns, and reduced motion.
---

# Sistema de diseño Farmamed

## Fuentes

- `DESIGN.md`: paleta oficial y usos.
- `app/globals.css`: tokens reales de la aplicación.
- `app/page.tsx`: referencia de composición editorial de la landing.
- `components/`: componentes existentes y estilo de implementación.

## Tokens

| Token | Valor | Uso |
| --- | --- | --- |
| `--ink` | `#1B0C68` | Texto principal, fondos oscuros |
| `--brand` | `#0B64B8` | Acciones primarias, enlaces |
| `--lime` | `#A5D737` | Acento, destacados |
| `--olive` | `#7B9C34` | Elementos secundarios |
| `--cyan` | `#009FE3` | Foco, hover, gráficos |
| `--background` | `#F7F9F5` | Fondo general |
| `--surface` | `#FFFFFF` | Tarjetas y superficies |
| `--muted` | `#647080` | Texto secundario |
| `--line` | `#DFE5DF` | Bordes y separadores |
| `--soft-blue` | `#EDF5FB` | Fondos informativos |
| `--soft-lime` | `#F1F7E5` | Fondos de acento suave |

Reglas:

- No usar colores genéricos de Tailwind para la marca.
- No usar lima o cian como único indicador de estado.
- Mantener contraste mínimo 4.5:1 en texto y 3:1 en componentes.
- El foco visible usa cian y no se elimina.

## Tipografía y composición

- Sans-serif del proyecto (`--font-geist-sans`) con fallback Arial, Helvetica.
- Títulos con tracking negativo y peso semibold, como la landing.
- Cuerpo de 14–16 px; metadatos de 11–13 px.
- Espacio amplio y retícula editorial; evitar pantallas saturadas.
- Esquinas suaves, bordes finos y sombras discretas.
- No usar emojis en la interfaz salvo solicitud explícita.

## Patrones de interfaz

- **Tablas:** encabezados claros, acciones por fila, estado vacío explicativo, sin paginación inventada.
- **Formularios:** etiqueta visible, ayuda contextual, error inline y resumen, conservar valores tras error.
- **Diálogos:** título, descripción, acción segura primaria y destructiva secundaria; foco atrapado.
- **Avisos:** toast para éxito, banner para error persistente, `aria-live` para anuncios.
- **Estados:** carga con esqueleto, vacío con causa y acción, error con reintento.
- **Navegación:** un solo grupo activo, `aria-current="page"`, operable por teclado.

## Copy

- Todo en español de Venezuela, claro y operativo.
- Marca visible: **Farmamed**.
- No usar “Farmamad” en la interfaz; ese es el nombre del API.
- No prometer funciones que el API no tiene.
- Identificar datos demostrativos como demostración.
- Evitar jerga técnica en mensajes al usuario.

## Accesibilidad

- HTML semántico y landmarks.
- Enlace “Saltar al contenido”.
- Controles con nombre accesible y etiquetas asociadas.
- Navegación completa por teclado.
- Foco visible y orden lógico.
- Diálogos con `role="dialog"`, `aria-modal` y retorno de foco.
- Errores con `role="alert"` cuando sean críticos.
- No depender del color.
- Respetar `prefers-reduced-motion`.

## Responsive

- Escritorio: operación completa.
- Tableta: navegación compacta, tablas con desplazamiento.
- Móvil: lectura y acciones simples; indicar cuándo una tarea requiere escritorio.
- Controles táctiles de al menos 44 px.
- Nada esencial depende de `hover`.

## Movimiento

- Transiciones de 150–200 ms.
- Sin animaciones continuas en pantallas operativas.
- La escena 3D se limita a login y bienvenida.
- Con `prefers-reduced-motion`, composición estática y sin desplazamientos.

## Formatos

- Fechas: `es-VE`, zona `America/Caracas`.
- Fechas sin hora: `dd/mm/aaaa`.
- Dinero: dos decimales, código y símbolo del API.
- Tasas: hasta seis decimales.
- Coordenadas: hasta siete decimales.
- Porcentajes: hasta dos decimales.

## Anti-patrones

- Colores de marca sustituidos por paletas genéricas.
- Texto solo en placeholders.
- Botones sin nombre accesible.
- Tablas con datos inventados para “llenar” el diseño.
- Paginación falsa o métricas sin endpoint.
- Animaciones que ignoran `prefers-reduced-motion`.
- Mezclar Farmamed y Farmamad en el mismo copy.
