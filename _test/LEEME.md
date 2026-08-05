# Pruebas automáticas

Tres suites que abren el revisor en un Chromium real. **No hacen falta para usarlo**;
están por si tocas `index.html` y quieres asegurarte de no haber roto nada.

- **`test.js`** (63 checks) — el núcleo: carga, layout al 50 %, paso a paso, cinta de
  segundos, captura de frame (comprueba que el JPEG tenga el color real del clip),
  errores, guardar/reabrir avance e informe completo con checkboxes, filtros,
  persistencia y export. Más casos límite: SRT con BOM, CRLF, etiquetas y timecodes
  con hora.

- **`test-esencia.js`** (37 checks) — paquete de **Casiel Nieto**: doc con el `C) Título`
  terminado en `.mp4`, los 10 SRT pegados **en orden distinto al de los clips** y 10
  vídeos. Verifica el cruce 10/10 y que el cotejo pilla las palabras metidas a mano.

- **`test-piti.js`** (29 checks) — paquete de **Piti Pinsach**: el `.srt` real de la
  secuencia entera (34 min, 1136 líneas, con `<font color="#009df9">`) y el doc de 30
  clips de los que sólo 15 están montados. Verifica que los 15 vídeos cogen su tramo
  del `.srt` (±3 líneas), que los tiempos caben dentro de cada vídeo, que el resalte se
  conserva y que saltan los avisos de la regla ESENCIA.

- **`test-persistencia.js`** (25 checks) — las dos redes de seguridad: los 15 vídeos de
  Piti **renombrados** a `PITI_reel_01_MAO.webm` (el nombre ya no dice nada) cruzan
  igual 15/15 por duración + orden; el desplegable manual manda y se puede deshacer.
  Y el autoguardado: marca trabajo, **recarga la página**, recupera todo (errores,
  capturas, segundos, cabecera) y al volver a soltar los vídeos se reenganchan sin
  duplicar ni perder nada.

## Correrlas

```bash
npm i playwright && npx playwright install chromium
node test.js && node test-esencia.js && node test-piti.js && node test-persistencia.js
```

Necesitan fixtures en `/tmp/qc/fixtures`, `/tmp/qc/fix2`, `/tmp/qc/fix3` y `/tmp/qc/fix4`.
Última pasada: **63 + 37 + 29 + 25 = 154 OK · 0 fallos**.
