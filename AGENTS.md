<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Farmamed ERP: contexto del proyecto

Landing page en español para presentar el ERP de Farmamed orientado a droguerías. El stack es Next.js 16 con App Router, React 19, TypeScript, Tailwind CSS 4 y Three.js sin un framework 3D adicional.

### Comandos

- `npm run dev`: entorno de desarrollo.
- `npm run lint`: análisis estático de todo el proyecto.
- `npm run build`: compilación de producción; debe pasar antes de entregar.
- `npm run start`: sirve la compilación de producción.

### Estructura

- `app/page.tsx`: contenido principal y secciones; debe permanecer como Server Component.
- `app/globals.css`: tokens de marca, estilos compartidos y preferencias de movimiento.
- `app/layout.tsx`: fuentes, idioma y metadata.
- `components/pharma-experience.tsx`: límite cliente y carga diferida de la escena.
- `components/pharma-scene.tsx`: geometría, texturas, animación y limpieza de Three.js.
- `components/product-showcase.tsx`: panel demostrativo interactivo.
- `public/assets/image.png`: recurso original del logo; no sobrescribirlo.
- `DESIGN.md`: referencia oficial de la paleta de marca.

### Diseño y contenido

- Usar los tokens definidos en `app/globals.css`: índigo `#1B0C68`, azul `#0B64B8`, lima `#A5D737`, oliva `#7B9C34` y cian `#009FE3`. No sustituirlos por colores genéricos de Tailwind.
- Mantener textos, navegación, metadata y mensajes accesibles en español. El tono debe ser claro, cercano y orientado a operaciones de droguerías.
- Conservar una estética limpia y editorial: espacio amplio, esquinas suaves, retículas técnicas discretas y contraste alto.
- Los datos del panel son ilustrativos y deben seguir identificados como demostración. No inventar clientes, cifras comerciales, integraciones ni envíos a servicios que no existan.
- Mantener navegación por teclado, foco visible, controles con nombres accesibles, diseño móvil y soporte para `prefers-reduced-motion`.

### Next.js y React

- Consultar la guía correspondiente de `node_modules/next/dist/docs/` antes de adoptar o cambiar APIs de Next.js. Conservar el bloque automático `nextjs-agent-rules` anterior.
- Usar Server Components por defecto. Añadir `"use client"` solo en el límite que necesita estado, eventos o APIs del navegador.
- La opción `ssr: false` de `next/dynamic` solo se utiliza dentro de Client Components.
- No añadir dependencias para iconos, modelos o interacciones que ya están resueltas localmente sin justificar la necesidad.

### Agentes y skills

- `.opencode/agents/builder.md`: implementa cambios de interfaz y delega en `reviewer` y `qa`.
- `.opencode/agents/reviewer.md`: revisa sin editar y devuelve hallazgos con severidad.
- `.opencode/agents/qa.md`: verifica lint, build, arranque y respuestas HTTP sin editar.
- `.opencode/agents/design-issue-writer.md`: redacta y publica issues de diseño desde las HU del API.
- `.opencode/skills/farmamed-design-system/`: tokens, copy, accesibilidad, responsive y movimiento.
- `.opencode/skills/nextjs-16-guardrails/`: APIs de Next.js 16, límites cliente/servidor y verificación.
- `.opencode/skills/threejs-scene-lifecycle/`: creación, pausa, fallback y limpieza de Three.js.
- `.opencode/skills/api-contract-farmamed/`: endpoints, roles, errores, moneda y relación stocks/lotes.
- `.opencode/skills/design-issue-spec/`: plantilla, épicas, fases y reglas de publicación de issues.
- Solo `builder` escribe código. `reviewer` y `qa` son de solo lectura. `design-issue-writer` publica issues y no implementa.
- Los prompts están en español y heredan el modelo de la sesión.
- `.kimi-code/agents/` contiene las versiones para Kimi Code, generadas desde `.opencode/agents/` con `node scripts/sync-kimi-agents.mjs`.
- `.kimi-code/skills` enlaza a `.opencode/skills`, de modo que ambos agentes usan las mismas skills.
- En opencode los permisos viven en `permission`; en Kimi Code se aplican con `tools`, `disallowedTools` y `subagents`.
- `reviewer`, `qa` y `design-issue-writer` no tienen `Write` ni `Edit` en Kimi Code.
- Tras cambiar agentes o skills, ejecutar `node scripts/sync-kimi-agents.mjs`; en opencode reiniciar la sesión y en Kimi Code abrir una sesión nueva o usar `/reload`.
- Los cambios en `.opencode/` requieren reiniciar opencode para cargarse.

### Three.js

- La escena se construye con geometría y texturas procedurales; no requiere descargas de modelos. Si se incorpora un asset externo, documentar origen y licencia y guardarlo en `public/assets/`.
- No acceder a WebGL, `window` o `document` durante el render del servidor. Crear la escena dentro de `useEffect`.
- Limitar la densidad de píxeles, adaptar cámara y renderer con `ResizeObserver`, pausar la animación fuera del viewport o con la pestaña oculta y ofrecer un fallback sin WebGL.
- Respetar `prefers-reduced-motion`: la escena debe conservar una composición estática útil sin animación continua.
- Al desmontar, cancelar `requestAnimationFrame`, desconectar observadores y listeners, y disponer texturas, materiales, geometrías y renderer. Compartir recursos no elimina la obligación de liberarlos.
- Mantener el canvas fuera del orden de tabulación y proporcionar una descripción accesible de la composición.

### Antes de entregar

1. Ejecutar `npm run lint` y `npm run build` y corregir los errores introducidos.
2. Probar la página mediante una petición real al servidor y revisar escritorio, móvil, navegación, pestañas y canvas cuando el entorno lo permita.
3. No presentar como verificada una interacción que no se haya ejercitado.
4. Si cambian las convenciones, la estructura o los comandos documentados aquí, actualizar este archivo en el mismo cambio.
