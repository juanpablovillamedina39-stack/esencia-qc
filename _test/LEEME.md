# Prueba automática

`test.js` abre el revisor en un Chromium real y comprueba 63 cosas: carga de clips y
SRT, reparto de subtítulos, layout al 50 %, paso a paso, cinta de segundos, captura de
frame (incluso que el JPEG tenga el color real del clip), marcado de errores, guardar y
reabrir el avance, y el informe completo — capturas incrustadas, checkboxes, filtros,
persistencia y export del estado.

**No hace falta para usar el revisor.** Está aquí por si alguna vez tocas `index.html`
y quieres asegurarte de no haber roto nada.

## Correrla

```bash
npm i playwright && npx playwright install chromium

# clips y SRT de prueba (necesita ffmpeg)
mkdir -p /tmp/qc/fixtures && cd /tmp/qc/fixtures
ffmpeg -y -f lavfi -i "color=c=0x1b3a5c:s=540x960:d=12,format=yuv420p" -c:v libvpx-vp9 -b:v 300k reel01.webm
ffmpeg -y -f lavfi -i "color=c=0x5c1b3a:s=540x960:d=18,format=yuv420p" -c:v libvpx-vp9 -b:v 300k reel02.webm
ffmpeg -y -f lavfi -i "color=c=0x3a5c1b:s=540x960:d=9,format=yuv420p"  -c:v libvpx-vp9 -b:v 300k reel03.webm
# + un proyecto.srt con timecodes corridos de 0 a 39 s

node test.js
```

Última pasada: **63 OK · 0 fallos**.
