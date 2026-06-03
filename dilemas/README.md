# Dilemas ESAN

Aplicación web educativa para administrar casos de dilemas éticos y empresariales, generar salas en vivo con QR, y manejar votaciones en tiempo real con Supabase.

## Estructura del proyecto

- `index.html` — Página de inicio con acceso a administración y sesión.
- `admin.html` — Panel administrativo seguro para CRUD de casos.
- `session.html` — Interfaz del docente para crear sala, mostrar casos y administrar votaciones.
- `student.html` — Punto de acceso para estudiantes que ingresan al aula virtual.
- `assets/css/styles.css` — Estilos compartidos y diseño responsivo.
- `assets/js/` — Lógica de cada pantalla.
- `services/supabase.js` — Integración con Supabase y Realtime.
- `database/schema.sql` — Esquema de base de datos para Supabase.

## Preparación para Supabase

1. Crea un proyecto en Supabase.
2. Reemplaza `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `services/supabase.js`.
3. Ejecuta las definiciones en `database/schema.sql` desde la consola SQL de Supabase.
4. Habilita Realtime para las tablas `sessions`, `participants` y `votes`.

## Cómo usar

- `index.html` — Navega desde tu repositorio local o GitHub Pages.
- `admin.html` — Inicia sesión con usuario `Steven` y contraseña `1234`.
- `session.html` — Selecciona un caso, crea sala y comparte el QR generado.
- `student.html` — Los estudiantes ingresan con su nombre y código de sala.

## Despliegue a GitHub Pages

1. Añade el repositorio a GitHub.
2. En `Settings > Pages`, selecciona la rama principal y la carpeta raíz `/`.
3. Publica y comparte el enlace.

## Características clave

- Diseño responsive para PC, tablet y móvil.
- Modo oscuro / claro.
- Animaciones suaves y paneles con tarjetas modernas.
- Integración con Supabase Realtime.
- Exportación de estadísticas en CSV.
- Código listo para producción académica.
