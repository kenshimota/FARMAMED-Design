---
name: release-flow
description: Use when releasing, merging issues into dev, creating version tags, or executing the FARMAMED-Design issue cycle (branch, builder, qa+reviewer, PR, CI, merge, close, delete branch, tag). Covers patch versioning v0.4.x up to 99, conflict handling with parallel sessions, and which changes get tagged.
---

# Flujo de release de FARMAMED-Design

## Selección de issues

- Orden de prioridad: etiqueta `fase-N` ascendente y luego número de issue ascendente.
- Excluir los issues con etiqueta `en progreso` (alguien más trabaja en ellos).
- Excluir los issues con etiqueta `epica`: son contenedores de seguimiento, no se implementan como PR.
- Procesar de uno en uno: cerrar todo el ciclo de un issue antes de empezar el siguiente.

## Ciclo por issue

1. `git pull origin dev` y crear rama `feat/<slug>` desde `dev` (slug corto en kebab-case, p. ej. `feat/fdn-02-dashboard`).
2. Asignar el issue al agente `builder`: implementa la interfaz según el cuerpo del issue y verifica con `npm run lint`, `npm run build` y servidor real. El builder deja los cambios sin commitear; el orquestador controla git.
3. Ejecutar `qa` y `reviewer` en paralelo. Compilar hallazgos y volver con `builder` si hay correcciones; repetir verificación si el cambio es sustancial.
4. Commit `feat: <título en español>` (estilo de historial), push y `gh pr create --base dev`.
5. Esperar el pipeline CI. Si falla, corregir y re-pushear antes de continuar.
6. Si `dev` avanzó por trabajo paralelo y la rama tiene conflictos: `git pull origin dev` dentro de la rama feature, resolver conflictos, push y esperar CI de nuevo. Nunca mergear `dev` con CI rojo.
7. Merge a `dev` con squash (el commit queda como `feat: … (#PR)`).
8. Cerrar el issue manualmente con `gh issue close <n>`: las keywords tipo `Closes #N` solo auto-cierran hacia la rama por defecto (`main`), no hacia `dev`.
9. Eliminar la rama local y remota una vez unida.
10. Crear el tag de la siguiente versión apuntando al commit de merge en `dev` y hacer `git push origin <tag>` (el push del tag dispara CI).

## Versionado

- Formato `vX.Y.Z`. Cada deploy (merge de un issue a `dev`) incrementa el último número: `v0.4.0` → `v0.4.1` → `v0.4.2` → …
- Al llegar a `v0.X.99`, el siguiente deploy salta a `v0.X+1.0`.
- Calcular siempre la versión desde el último tag existente en el momento del merge (`git tag --sort=-creatordate`), porque otra sesión puede haber publicado tags nuevos.
- Los cambios `chore`/`docs` (skills, agentes, AGENTS.md) van por PR a `dev` sin tag: solo los features de issues generan release.

## Conflictos con sesiones paralelas

- Antes de crear la rama y antes del merge, traer `origin/dev`.
- Si otra sesión fusiona en `dev` mientras se trabaja, resolver en la rama feature con `git pull origin dev`.
- Los números de issue, PR y versión se consultan siempre frescos con `gh` y `git fetch --prune`; no asumir los valores vistos al inicio de la sesión.
