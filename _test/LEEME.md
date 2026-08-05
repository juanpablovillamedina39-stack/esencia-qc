# Pruebas automáticas

Dos suites que abren el revisor en un Chromium real. **No hacen falta para usarlo**;
están aquí por si tocas `index.html` y quieres asegurarte de no haber roto nada.

- **`test.js`** — 63 comprobaciones del núcleo: carga, layout al 50 %, paso a paso,
  cinta de segundos, captura de frame (verifica que el JPEG tenga el color real del
  clip), errores, guardar/reabrir avance, informe completo con checkboxes, filtros,
  persistencia y export. Más casos límite: SRT con BOM, CRLF, etiquetas y timecodes
  con hora.

- **`test-esencia.js`** — 37 comprobaciones con el paquete real: el `.docx` de
  aprobados de Casiel Nieto, los 10 SRT pegados **en orden distinto al de los clips**
  y los 10 vídeos. Verifica que cada vídeo cae en su clip del doc por nombre de
  archivo, que cada clip se queda con su bloque del `.srt` por contenido (10/10), que
  el cotejo subraya las palabras metidas a mano y que el sync se calibra con el vídeo.

## Correrlas

```bash
npm i playwright && npx playwright install chromium
node test.js
node test-esencia.js
```

Necesitan fixtures en `/tmp/qc/fixtures` y `/tmp/qc/fix2` (vídeos generados con ffmpeg
y los SRT correspondientes). Última pasada: **63 OK + 37 OK · 0 fallos**.
