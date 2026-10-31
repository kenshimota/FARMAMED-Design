"use client";

import { useLayoutEffect, useState } from "react";

// Con `cacheComponents`, Next.js oculta las rutas anteriores con `<Activity>`
// en lugar de desmontarlas: su DOM queda en el documento con `display: none`.
// Este hook detecta esa pausa (la limpieza de efectos se ejecuta al ocultar y
// el efecto vuelve a ejecutarse al reaparecer) para retirar del DOM el
// contenido oculto y evitar encabezados o ids duplicados junto a la ruta
// visible. Solo se conserva el estado del componente que usa el hook: al
// renderizar `null`, su subárbol se desmonta y remonta al ocultar/mostrar, así
// que los hijos pierden su estado (un borrador de línea a medio digitar se
// descarta al navegar; decisión documentada, sin elevar estado). La
// restauración corre en microtarea —antes del pintado— porque la regla
// `react-hooks/set-state-in-effect` impide el `setState` sincrónico en el
// cuerpo del efecto; el guardado con `active` cancela la restauración si la
// ruta vuelve a ocultarse antes de que corra.
export function useActivityVisible() {
  const [hidden, setHidden] = useState(false);

  useLayoutEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setHidden(false);
    });
    return () => {
      active = false;
      setHidden(true);
    };
  }, []);

  return !hidden;
}
