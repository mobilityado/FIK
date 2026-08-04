# Asistente de consulta PP / PK

Proyecto web para GitHub Pages conectado a Google Apps Script y Google Sheets.

## Funciones

- Valida la clave del empleado.
- Detecta acceso SUR/SUR VB, TRT/TRT VB, ADO CORTO/ADO LARGO.
- Los usuarios de `ADMINISTADOR` pueden consultar todas las marcas.
- Obtiene las corridas directamente de los nombres de las pestañas.
- Localiza las columnas por encabezado: `INGRESO`, `INGRESO MINIMO`, `PP_` y `PK_`.
- Muestra el ingreso mínimo donde PP deja de ser cero.
- Busca el factor correspondiente al mayor rango de ingreso menor o igual al importe capturado.
- Permite volver a corridas, cambiar de marca o comenzar otra consulta.

## 1. Configurar Google Apps Script

1. Abre tu proyecto actual de Apps Script.
2. Sustituye el contenido del archivo `Code.gs` por el incluido en este proyecto.
3. Guarda.
4. Ve a **Implementar > Nueva implementación > Aplicación web**.
5. Ejecutar como: **Yo**.
6. Quién tiene acceso: **Cualquier persona**.
7. Copia la nueva URL terminada en `/exec`.
8. Pega esa URL en `config.js`.

> Cada cambio del Apps Script requiere crear o actualizar la implementación para que la web use la nueva versión.

## 2. Subir a GitHub

Sube a la raíz del repositorio:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`

`Code.gs` y este README pueden conservarse como respaldo, pero no son necesarios para que GitHub Pages muestre la web.

En GitHub entra a **Settings > Pages**, selecciona **Deploy from a branch**, rama `main`, carpeta `/root` y guarda.

## Regla usada para el rango

La API ordena las filas por la columna `INGRESO` y toma la última fila cuyo ingreso sea menor o igual al importe introducido. El ingreso mínimo para PP se obtiene de la primera fila donde `PP_ > 0`; si existe `INGRESO MINIMO`, se usa el valor de esa misma fila.

## Seguridad

La clave únicamente identifica al colaborador; no funciona como contraseña. Para datos sensibles se recomienda añadir autenticación corporativa o un PIN independiente.
