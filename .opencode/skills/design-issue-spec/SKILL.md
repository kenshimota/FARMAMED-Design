---
name: design-issue-spec
description: Use when creating or reviewing design issues in FARMAMED-Design from API HU issues. Covers epics, phases, numbering, labels, mandatory sections, brand decisions, and publication rules.
---

# Especificación de issues de diseño

## Objetivo

Convertir cada HU de producto del API en un issue de diseño completo, verificable y enlazado. No implementar código.

## Repositorios

- Destino: `kenshimota/FARMAMED-Design`.
- Fuente: `kenshimota/api-farmamad-express`.
- Leer con `gh issue view`; publicar con `gh issue create`.
- Verificar duplicados con `gh issue list --state all`.

## Decisiones fijas

- ERP web completo bajo `/app/*`; landing en `/`.
- Marca visible **Farmamed**; el API usa **Farmamad**.
- Seis roles: `admin`, `customer`, `seller`, `dispatcher`, `manager_warehouse`, `support`.
- Escritorio primero; móvil de consulta y acciones simples.
- Three.js solo en login y bienvenida.
- Moneda por registro; sin conversión automática.
- `stocks` y `lots` en dos vistas separadas.
- Mapa de clientes con Leaflet + OpenStreetMap.
- Ventas, Pedidos, Entregas y Reportes deshabilitados como “Próximamente”.
- JWT con re-login ante `401`; sin refresh token.
- Sin datos, clientes, cifras o integraciones inventadas.

## Historias incluidas

HU-01, HU-02, HU-03, HU-05, HU-07/HU-10, HU-08, HU-11, HU-13, HU-14, HU-15, HU-16, HU-17, HU-18, HU-19, HU-20, HU-21, HU-22, HU-23, HU-24, HU-25 y HU-26.

Excluidas: HU-04, HU-06, HU-09 y HU-12.

## Épicas y fases

| Épica | Prefijo | Fase |
| --- | --- | --- |
| Fundaciones | `FDN` | 1 |
| Acceso y usuarios | `ACC` | 1 |
| Catálogo | `CAT` | 2 |
| Operación | `OPE` | 2 |
| Inventario y compras | `INV` | 3 |
| Finanzas | `FIN` | 3 |

Mapa:

- CAT-01 categorías, CAT-02 imágenes, CAT-03 productos, CAT-04 estados/ciudades, CAT-05 proveedores, CAT-06 estados de ítem.
- OPE-01 clientes, OPE-02 bodegas, OPE-03 estantes/secciones, OPE-04 asignación clientes-vendedores.
- INV-01 costos, INV-02 existencias, INV-03 lotes, INV-04 compras.
- FIN-01 monedas e historial, FIN-02 moneda en costos/compras/stock.

## Secciones obligatorias

1. Título con prefijo y número.
2. Épica, fase e historia(s) del API con enlace.
3. Contexto.
4. Objetivo de diseño.
5. Alcance y fuera de alcance.
6. Rutas.
7. Flujo principal.
8. Pantalla y componentes.
9. Datos y contrato de API.
10. Permisos por rol.
11. Estados y feedback.
12. Copy de interfaz.
13. Responsive.
14. Accesibilidad y movimiento.
15. Criterios de aceptación.
16. Dependencias.
17. Preguntas abiertas.

## Reglas de contenido

- Un issue por HU; HU-07 y HU-10 comparten ACC-05.
- Incluir endpoints reales, roles reales y errores reales.
- Incluir carga, vacío y error.
- Incluir `202` como cambio guardado, no como proceso en segundo plano.
- No inventar paginación, búsqueda global, exportación ni analítica.
- No prometer funciones sin API.
- Marcar datos de ejemplo como demostración.
- Mantener español de Venezuela.

## Etiquetas

`diseño`, `ux`, `frontend`, `accesibilidad`, `epica`, `fase-1`, `fase-2`, `fase-3`.

## Publicación

- Crear subissues y épica, o épica y actualizarla con los números reales.
- Usar `gh issue create --body-file` con archivos temporales en `/tmp/opencode`.
- No editar código.
- Verificar cada issue con `gh issue view`.
- Reportar números, URLs, etiquetas y pendientes.
