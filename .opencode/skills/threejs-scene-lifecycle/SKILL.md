---
name: threejs-scene-lifecycle
description: Use when touching components/pharma-scene.tsx, components/pharma-experience.tsx, Three.js, WebGL, canvas, animations, 3D performance, cleanup, fallback, or reduced-motion behavior.
---

# Ciclo de vida de escenas Three.js

## Contexto

La escena se construye con geometría y texturas procedurales. No requiere modelos externos. Vive detrás de un límite cliente y no debe ejecutarse durante el render del servidor.

## Creación

- Crear escena, cámara, renderer y recursos dentro de `useEffect`.
- No acceder a `window`, `document` o WebGL en el render del servidor.
- Limitar `devicePixelRatio` a un máximo razonable, por ejemplo 2.
- Adaptar cámara y renderer con `ResizeObserver`.
- Usar texturas y materiales procedurales; no descargar assets sin documentar origen y licencia.

## Animación

- Pausar la animación cuando el canvas está fuera del viewport.
- Pausar cuando `document.visibilityState === "hidden"`.
- Respetar `prefers-reduced-motion`: composición estática útil, sin animación continua.
- No usar animaciones que consuman CPU sin aportar información.

## Accesibilidad

- Mantener el canvas fuera del orden de tabulación.
- Proporcionar una descripción accesible de la composición.
- El canvas no debe ser el único medio para comunicar información.
- Ofrecer fallback sin WebGL.

## Limpieza al desmontar

Cancelar y liberar:

- `requestAnimationFrame`;
- `ResizeObserver`;
- listeners de `resize`, `visibilitychange` y otros;
- texturas;
- materiales;
- geometrías;
- renderer;
- cualquier recurso creado por la escena.

Compartir recursos no elimina la obligación de liberarlos.

## Verificación

- `npm run lint`
- `npm run build`
- arranque real y petición a la página.
- Revisar que no haya errores en consola del navegador cuando sea posible.
- Si no puedes probar WebGL o la interacción visual, dilo explícitamente.

## Anti-patrones

- Crear el renderer en el módulo o en el render.
- Dejar `requestAnimationFrame` activo al desmontar.
- No desconectar observadores.
- Ignorar `prefers-reduced-motion`.
- Añadir dependencias 3D innecesarias.
- Exponer el canvas al tabulado sin razón.
