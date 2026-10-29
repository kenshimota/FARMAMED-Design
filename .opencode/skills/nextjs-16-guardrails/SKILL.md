---
name: nextjs-16-guardrails
description: Use before changing Next.js APIs, App Router routes, Server or Client Components, next/dynamic, metadata, fonts, build output, or deployment in this repo. Requires reading node_modules/next/dist/docs first because this Next.js version differs from training data.
---

# Guardrails de Next.js 16

## Regla principal

Esta versión de Next.js puede tener cambios incompatibles con el conocimiento previo. Antes de usar o modificar una API:

1. Identifica la API exacta.
2. Busca la guía correspondiente en `node_modules/next/dist/docs/`.
3. Lee la guía completa.
4. Solo entonces implementa.

No adivines firmas, convenciones de archivos ni comportamientos de caché.

## Arquitectura de componentes

- Server Components por defecto.
- `"use client"` solo en el límite que necesita:
  - estado o efectos;
  - eventos del navegador;
  - `window`, `document`, `localStorage`;
  - WebGL o APIs del navegador.
- No conviertas páginas enteras en Client Components por comodidad.
- La opción `ssr: false` de `next/dynamic` solo se usa dentro de Client Components.
- No accedas a APIs del navegador durante el render del servidor.

## Rutas

- App Router en `app/`.
- La landing vive en `/`.
- El ERP vive bajo `/app/*`.
- Usa layouts y route groups cuando aporten claridad, sin duplicar el shell.
- Mantén `lang="es"`, metadata y fuentes en `app/layout.tsx`.

## Estilos

- Tailwind CSS 4 con tokens definidos en `app/globals.css`.
- No agregues una segunda librería de estilos.
- No agregues dependencias de iconos o animación sin justificar.
- Conserva el bloque automático `nextjs-agent-rules` de `AGENTS.md`.

## Verificación

Antes de entregar:

```bash
npm run lint
npm run build
```

Después:

```bash
npm run start -- -p 3100
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3100/
```

Detén el servidor al terminar. No afirmes que una interacción funciona si no la ejercitaste.

## Lo que no debes hacer

- Introducir `use client` en `app/page.tsx` sin necesidad.
- Usar `ssr: false` fuera de un Client Component.
- Acceder a `window`, `document` o WebGL en el servidor.
- Ignorar advertencias de build.
- Sobrescribir `public/assets/image.png`.
- Cambiar la configuración de despliegue o Docker sin pedirlo.
- Hacer commit, push o PR sin solicitud explícita.
