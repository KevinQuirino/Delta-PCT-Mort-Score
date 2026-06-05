# Delta-PCT-Mort-Score

Este proyecto contiene:

- `frontend/`: archivos HTML, CSS y JavaScript para la aplicación estática.
- `backend/`: servidor Node.js opcional.

## Despliegue recomendado

Usa GitHub Pages para desplegar el sitio estático desde `frontend/`.

El workflow de GitHub Actions en `.github/workflows/deploy-frontend.yml` publica automáticamente el contenido de `frontend/` en la rama `gh-pages` cuando haces push a `main`.

## URL de GitHub Pages

Después de que la acción se ejecute, la app estará disponible en:

`https://KevinQuirino.github.io/Delta-PCT-Mort-Score/`

Si necesitas desplegar también el backend, usa un servicio como Render o Railway.
