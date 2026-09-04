# Estándar de interfaz deportiva

## Alcance

Aplica a toda interfaz web de `frontend-liga/`. Preserva contratos API y lógica funcional.

## Dirección visual

- Apariencia deportiva profesional, enérgica y limpia, con jerarquía clara para operación y datos.
- Verde cancha como acción principal, azul para estadísticas y dorado para logros.
- Tipografía sans serif legible; cifras, resultados, importes y estadísticas usan números tabulares.
- Sombras y radios consistentes; la información debe dominar sobre los efectos decorativos.

## Temas

- Claro y oscuro son equivalentes y se implementan con tokens semánticos, nunca mediante inversión automática.
- La preferencia elegida se persiste en `localStorage`; sin preferencia, se detecta `prefers-color-scheme`.
- Superficies, texto, bordes, controles, estados y gráficos deben conservar contraste WCAG AA en ambos temas.

## Componentes y accesibilidad

- Navegación, tarjetas, tablas, formularios, botones, estados y dashboards reutilizan tokens globales.
- Todo control tiene estado hover, active, focus-visible y disabled distinguible.
- Targets interactivos de al menos 44×44 px, foco visible de 3 px y etiquetas accesibles en controles de solo icono.
- No comunicar estados únicamente por color; acompañarlos con texto o iconografía.
- Respetar `prefers-reduced-motion`; las transiciones solo animan opacidad o transform.

## Responsive

- Mobile-first, usable desde 375 px sin scroll horizontal de página.
- Contenedores fluidos con ancho máximo coherente; tablas pueden desplazarse dentro de su propio contenedor.
- Formularios, barras de acciones y grillas se apilan en móvil y se expanden progresivamente a 768/1024 px.

## Dependencias

No agregar librerías visuales ni fuentes obligatorias si el sistema puede resolverse con CSS, SVG existente y fuentes del sistema.
