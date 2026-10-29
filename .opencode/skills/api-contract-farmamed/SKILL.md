---
name: api-contract-farmamed
description: Use when mapping or consuming the Farmamad Express API from the Farmamed design project. Covers endpoints, roles, error shapes, currency, stocks vs lots, and rules against inventing data.
---

# Contrato del API Farmamad para la interfaz Farmamed

## Repositorio y entorno

- API: `kenshimota/api-farmamad-express`.
- Base local: `http://localhost:3001`.
- Swagger: `/docs`.
- Autenticación: `Authorization: Bearer <jwt>`.
- El API usa la marca **Farmamad**; la interfaz usa **Farmamed**. No mezclar en el copy visible.

## Roles reales

`admin`, `customer`, `seller`, `dispatcher`, `manager_warehouse`, `support`.

Reglas generales:

- `admin` administra todo.
- `seller` escribe catálogo, clientes, costos y compras; lee existencias, lotes, estantes, monedas y asignaciones propias.
- `dispatcher` lee clientes, bodegas, estantes, lotes, asignaciones y monedas.
- `manager_warehouse` escribe bodegas, estantes y lotes; lee existencias, costos, compras y monedas.
- `support` y `customer` solo leen catálogo.
- Los permisos exactos están en cada HU; no generalices de memoria.

## Respuestas y errores

- Éxito de creación: `201`.
- Lectura: `200`.
- `PUT`: `202 Accepted` con el recurso actualizado.
- `DELETE`: `204` sin cuerpo.
- Error con mensaje: `{ "message": "..." }`.
- Error de validación: `{ "errors": { "campo": "mensaje" } }`.
- `400` faltan campos; `401` no autenticado; `403` sin permiso o bloqueado; `404` inexistente; `409` conflicto; `422` validación o referencia inválida; `429` cooldown; `502` fallo de correo; `503` moneda por defecto no configurada; `500` error interno.
- No mostrar el cuerpo crudo del API; traducir a copy de interfaz.

## Endpoints por módulo

### Autenticación y usuarios

- `POST /auth/login`
- `GET /auth/me`
- `GET /auth/setup-status`
- `POST /auth/register-admin`
- `POST /auth/forgot-password`
- `POST /auth/verify-reset-code`
- `POST /auth/reset-password`
- `GET /users`, `POST /users`, `PATCH /users/:id/status`, `DELETE /users/:id`
- `GET /roles`

### Catálogo

- `/categories`
- `/images`
- `/products`
- `/states`, `/cities`
- `/suppliers`
- `/item-states`

CRUD estándar. Lecturas para cualquier usuario autenticado; escrituras para `admin` y `seller` salvo indicación contraria.

### Operación

- `/customers`: lectura `admin`, `seller`, `dispatcher`; escritura `admin`, `seller`.
- `/warehouses`: lectura `admin`, `dispatcher`, `manager_warehouse`; escritura `admin`, `manager_warehouse`; filtro `?search=`.
- `/shelves`, `/shelves/:shelf_id/sections`: lectura `admin`, `seller`, `manager_warehouse`, `dispatcher`; escritura `admin`, `manager_warehouse`.
- `/customer-sellers`: lectura `admin`, `dispatcher`, `seller` (solo propias); escritura `admin`, `seller` (solo propias).

### Inventario y compras

- `/costs`: lectura `admin`, `seller`, `manager_warehouse`; escritura `admin`, `seller`; también `/costs/product/:product_id`.
- `/stocks`: solo lectura para `admin`, `seller`, `manager_warehouse`; `/stocks/available?product_id=` y `/stocks/available/:product_id`.
- `/lots`: lectura `admin`, `seller`, `manager_warehouse`, `dispatcher`; escritura `admin`, `seller`, `manager_warehouse`; filtros `expired`, `expiring_before`, producto, estado y ubicación.
- `/purchases`: lectura `admin`, `seller`, `manager_warehouse`; escritura `admin`, `seller`; líneas en `/purchases/:id/items`; `confirm` y `cancel`.

### Finanzas

- `/currencies`: lectura `admin`, `seller`, `manager_warehouse`, `dispatcher`; escritura solo `admin`.
- `/currencies/:id/history`: lectura con los mismos roles.
- La moneda por defecto de transacciones es `USD_BCV` y no se cambia por API en esta versión.

## Moneda

- `costs` y `purchases` llevan `currency_id`; las líneas heredan la moneda de la compra.
- La interfaz elige moneda por registro desde `GET /currencies`.
- No hay conversión automática de montos.
- Cambiar la moneda no convierte el número; solo cambia su interpretación.
- La moneda por defecto no se puede desactivar.
- Si falta la moneda por defecto, el API responde `503`.

## Existencias y lotes

- `stocks` es el agregado por `(product_id, item_state_id)`; se actualiza al confirmar compras.
- `lots` es el detalle físico por lote, vencimiento, estado y ubicación.
- No se sincronizan automáticamente en esta versión.
- La interfaz debe presentarlos en dos vistas separadas y avisar que pueden diferir.

## Reglas de interfaz

- No inventar endpoints, campos, filtros, paginación ni métricas.
- No asumir que una lista viene paginada.
- No prometer ventas, pedidos, entregas, reportes ni analítica.
- Identificar datos de ejemplo como demostración.
- Verificar los permisos en la HU correspondiente antes de mostrar una acción.
- No mostrar `createdAt` ni `updatedAt`: el API no los expone en las respuestas de negocio.
