# Validación del catálogo demo con volumen

Esta guía reproduce la validación de CAT-10 sobre un entorno con la semilla demo del API (HU-45) cargada. No crea pantallas ni datos: comprueba el comportamiento real de catálogo, tienda, detalle, imágenes y carrito con 100 o más productos.

> **Estado:** pendiente de validación con volumen real. La semilla demo (HU-45), FDN-04 (#94) y CAT-09 (#95) todavía no están integrados. Mientras falten, CAT-10 no debe presentarse como validado con 100+ productos reales: esta rama solo deja preparados los criterios y los ajustes de interfaz que no dependen de esas historias.

## Dependencias

| Dependencia | Estado en esta rama | Efecto en la validación |
| --- | --- | --- |
| HU-45 del API y `seed:demo` ejecutada | Pendiente | Sin la semilla no hay 100+ productos que validar; la validación con volumen real queda bloqueada. |
| FDN-04 (paginación y filtros en servidor, #94) | Pendiente | La interfaz sigue descargando listas planas y filtrando en el navegador. No se validan páginas, rangos ni `meta.total` todavía. |
| CAT-09 (impuesto por producto, #95) | Pendiente | El detalle y el listado no muestran impuesto en esta rama. |
| CAT-08 y CLI-03 | Integradas | Aportan miniaturas, tienda y carrito. |
| Entorno con la semilla cargada | Pendiente | Requiere acceso autenticado a la API de demostración. |

No existe un campo `is_demo` en el API. Por eso no se añade una etiqueta de demostración por producto y no se infiere por nombre, referencia o categoría. El aviso global de demostración tampoco se muestra: no hay una variable de entorno aprobada para activarlo.

## Preparación

1. Confirma que el API responde y que la semilla demo ya se ejecutó.
2. Define la URL del API en la misma terminal. `NEXT_PUBLIC_API_URL` se incrusta en el bundle, así que debe estar presente al compilar y no solo al arrancar:

   ```bash
   export NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
   ```

3. Inicia la aplicación una sola vez en un puerto libre:

   ```bash
   PORT=3204 npm run dev
   ```

4. Inicia sesión con un usuario `admin` o `seller` para el catálogo interno y con un `customer` vinculado a cliente y lista de precios para la tienda.
5. Abre las herramientas del navegador en la pestaña Red para revisar las peticiones y el tamaño de las respuestas.

## Comprobaciones automáticas

```bash
npm run lint
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1 npm run build
```

`NEXT_PUBLIC_API_URL` se incrusta en el bundle: pásala al `build`, no solo al arrancar. `npm run start` sirve el resultado compilado; si cambias la URL del API, vuelve a compilar.

```bash
PORT=3204 npm run start
```

Solicita las rutas del issue y confirma que responden sin error de servidor. Sin sesión, las rutas protegidas devuelven la pantalla de carga del ERP y redirigen al iniciar sesión en el navegador. Sustituye `1` por un identificador real de la semilla cuando esté disponible; estos `curl` solo comprueban el código HTTP del cascarón, no los datos renderizados.

```bash
for path in /app/productos /app/productos/1 /app/tienda /app/tienda/1 /app/imagenes /app/carrito; do
  curl -sS -o /dev/null -w "$path -> %{http_code}\n" "http://127.0.0.1:3204$path"
done
```

## Validación manual

### Catálogo interno (`/app/productos`)

- [ ] Con 100+ productos, la primera pantalla muestra la tabla en escritorio y tarjetas en móvil.
- [ ] Hasta que se integre FDN-04, `/app/productos` sigue descargando `/products` y `/images` completos y filtrando en el navegador. No se validan paginación, `meta.total` ni el tamaño de la respuesta.
- [ ] La búsqueda por nombre o referencia reduce el listado y el contador cambia.
- [ ] El filtro de categoría reduce el listado y el contador cambia.
- [ ] «Limpiar filtros» restaura el listado y el contador.
- [ ] Las miniaturas cargan con proporción estable y no desplazan las filas.
- [ ] Si una imagen falla, aparece el marcador con el nombre accesible «No pudimos cargar la imagen…».
- [ ] Mientras las imágenes cargan se muestra el marcador de carga, no una imagen rota.
- [ ] El error de red del listado ofrece «Reintentar».
- [ ] El error de imágenes permite reintentar sin ocultar los productos.
- [ ] El listado vacío y el listado sin resultados muestran mensajes distintos.
- [ ] En móvil la tabla no se desborda: se usan tarjetas y las acciones quedan accesibles.
- [ ] En tableta la tabla usa desplazamiento horizontal controlado.

### Tienda del cliente (`/app/tienda`)

- [ ] Con 100+ productos, la retícula muestra 1 columna en móvil, 2 en tableta y 3–4 en escritorio.
- [ ] Hasta que se integre FDN-04, `/app/tienda` sigue descargando `/store/products` completo y filtrando en el navegador.
- [ ] El esqueleto de carga muestra 12 tarjetas y conserva la retícula.
- [ ] La búsqueda y el filtro de categoría actualizan el contador visible.
- [ ] El filtro de estado vendible recarga el listado y conserva el estado del formulario.
- [ ] Las tarjetas usan la miniatura y el detalle usa la imagen original cuando el API la entrega.
- [ ] Una imagen faltante o rota muestra el marcador, no una imagen de relleno.
- [ ] «Agregar al pedido» actualiza el aviso y el contador del carrito.
- [ ] El estado vacío, el error y «sin resultados» son distinguibles.

### Detalle de producto (`/app/productos/[id]` y `/app/tienda/[id]`)

- [ ] La imagen se carga de forma prioritaria y mantiene el espacio reservado.
- [ ] El nombre, la referencia, la categoría, el precio y la disponibilidad provienen del API.
- [ ] Si la imagen no existe o falla, se muestra el marcador y el texto «No pudimos cargar la imagen.».
- [ ] El detalle interno solicita la imagen por su identificador y no descarga el catálogo completo de imágenes.
- [ ] En la tienda, el cambio de estado actualiza precio y disponibilidad sin inventar datos.
- [ ] Un identificador inválido o inexistente muestra el estado de error correspondiente.

### Imágenes (`/app/imagenes`)

- [ ] Con 100+ imágenes, las tarjetas cargan por demanda y solo las primeras 4 del listado se priorizan; no se priorizan por posición en el viewport.
- [ ] La búsqueda por nombre o referencia reduce el listado y actualiza el contador.
- [ ] Si falta la miniatura, se usa la URL original como respaldo.
- [ ] Una URL rota muestra «No pudimos cargar la imagen.» sin ocultar el enlace original.
- [ ] El estado vacío, el error y «sin resultados» son distinguibles.

### Carrito (`/app/carrito`)

- [ ] Con varias líneas, la miniatura conserva su tamaño y el nombre no se deforma.
- [ ] En móvil el botón «Quitar» puede pasar a una segunda línea sin tapar el nombre.
- [ ] Las cantidades y los subtotales se actualizan y se anuncian con `aria-live`.
- [ ] El carrito vacío ofrece volver al inicio.

### Accesibilidad y movimiento

- [ ] Todos los filtros, paginación futura, tarjetas y acciones se pueden usar con teclado.
- [ ] El foco visible se conserva en enlaces, botones y campos.
- [ ] Los contadores se anuncian con `aria-live="polite"`.
- [ ] Las imágenes tienen texto alternativo útil y los marcadores tienen nombre accesible.
- [ ] Con `prefers-reduced-motion`, los esqueletos y las barras de recarga no se animan.

## Responsive

| Vista | Catálogo interno | Tienda | Imágenes | Carrito |
| --- | --- | --- | --- | --- |
| Escritorio | Tabla completa | 4 columnas | 3–4 columnas | Dos columnas con resumen lateral |
| Tableta | Tabla con desplazamiento | 2–3 columnas | 2–3 columnas | Una columna |
| Móvil | Tarjetas | 1–2 columnas | 1–2 columnas | Una columna, acciones envueltas |

Comprueba que las miniaturas mantengan su espacio antes y después de cargar. No debe haber saltos de layout al aparecer las imágenes.

## Pendiente de la semilla demo, FDN-04 y CAT-09

CAT-10 queda documentado, pero **no validado con volumen real**. La semilla demo (HU-45), FDN-04 (#94) y CAT-09 (#95) siguen pendientes. Cuando se integren, repite la validación con estos criterios adicionales:

- `/app/productos` deja de descargar `/products` y `/images` completos; solicita solo la página visible.
- La primera página se solicita con `page` y `page_size`; no se descargan los 100+ productos.
- Búsqueda, categoría e impuesto usan parámetros del API y actualizan `meta.total`.
- Los contadores muestran el rango «Mostrando {desde}–{hasta} de {total}».
- La paginación permite recorrer todas las páginas y volver a la primera.
- Una página fuera de rango ofrece volver a la primera página.
- El impuesto del producto se muestra en listado y detalle.
- El aviso global de demostración solo aparece si existe una variable de entorno aprobada.

## Limitaciones conocidas de esta validación

- La semilla demo todavía no se ha ejecutado en un entorno accesible; las comprobaciones con 100+ productos reales quedan pendientes.
- La API de demostración puede no estar disponible o no tener la semilla cargada; en ese caso las comprobaciones autenticadas quedan pendientes.
- Sin credenciales de demostración no se pueden ejercitar los estados con datos reales desde una petición HTTP simple. Las rutas se validan por código de respuesta y la interacción queda documentada para repetirla con sesión.
- Esta rama no implementa paginación, filtros de servidor ni impuesto por producto; esos cambios pertenecen a FDN-04 (#94) y CAT-09 (#95).
- Mientras FDN-04 siga pendiente, `/app/productos` continúa descargando el catálogo y las imágenes completos aunque la semilla tenga 100+ productos.
