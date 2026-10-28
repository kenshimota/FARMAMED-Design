# Sistema de Diseño - Paleta de Colores (Brand Guidelines)

Este documento define la paleta de colores oficial basada en los valores CMYK proporcionados en el manual de marca. Incluye conversiones a HEX y RGB para su uso en plataformas digitales e impresas.

## 1. Paleta de Colores Principal

A continuación se detallan los colores base de la marca, incluyendo sus usos específicos (como los asignados para el Logo).

| Muestra | Nombre del Color                           | CMYK (Impresión)                  | HEX (Web) | RGB (Digital)       | Uso Sugerido                                                                 |
| :-----: | :----------------------------------------- | :-------------------------------- | :-------- | :------------------ | :--------------------------------------------------------------------------- |
|   🟪    | **Deep Indigo**<br>_(Azul Oscuro/Violeta)_ | C=100, M=100, Y=0, K=45           | `#1B0C68` | `rgb(27, 12, 104)`  | Color primario oscuro. Fondos, tipografía principal de alto contraste.       |
|   🟩    | **Vibrant Lime**<br>_(Verde Lima)_         | C=40, M=0, Y=100, K=0             | `#A5D737` | `rgb(165, 215, 55)` | Color de acento. Botones secundarios, destacados, iconos.                    |
|   🟦    | **Brand Blue**<br>_(Azul Medio)_           | C=100, M=75, Y=0, K=0             | `#0B64B8` | `rgb(11, 100, 184)` | **Color exclusivo del Logo.** Enlaces, botones primarios.                    |
|   🫒    | **Olive Green**<br>_(Verde Oliva)_         | C=60, M=35, Y=100, K=0            | `#7B9C34` | `rgb(123, 156, 52)` | **Color exclusivo del Logo.** Elementos gráficos secundarios, fondos suaves. |
|   🟦    | **Bright Cyan**<br>_(Cian Brillante)_      | C=100, M=0, Y=0, K=0 _(Inferido)_ | `#009FE3` | `rgb(0, 159, 227)`  | Color complementario. Gráficos, ilustraciones, _hover states_.               |

## 2. Colores de Tipografía y Estado

| Muestra | Nombre         | HEX       | RGB                | Uso                                                                                                |
| :-----: | :------------- | :-------- | :----------------- | :------------------------------------------------------------------------------------------------- |
|   🟥    | **Alert Red**  | `#C1272D` | `rgb(193, 39, 45)` | Textos de advertencia, errores, o información importante (Ej. "Batch detail In Spanish Language"). |
|   ⬛    | **Text Black** | `#333333` | `rgb(51, 51, 51)`  | Texto principal en fondos claros. (Valores C, M, Y, K).                                            |

## 3. Tipografía Sugerida

_(Basado en el estilo visual de la imagen)_

- **Familia:** Sans-serif (Ej. Arial, Helvetica, Roboto, Open Sans).
- **Pesos:** Regular para cuerpo de texto, Medium/Bold para títulos y acrónimos (C, M, Y, K).

## 4. Variables CSS (Para Desarrollo Web)

Copia y pega este bloque en tu archivo CSS principal o en tu configuración de Tailwind/Frameworks:

```css
:root {
  /* Colores Principales */
  --color-deep-indigo: #1b0c68;
  --color-vibrant-lime: #a5d737;

  /* Colores del Logo */
  --color-brand-blue: #0b64b8;
  --color-olive-green: #7b9c34;

  /* Colores Complementarios */
  --color-bright-cyan: #009fe3;

  /* Estados y Textos */
  --color-alert-red: #c1272d;
  --color-text-dark: #333333;
}
```
