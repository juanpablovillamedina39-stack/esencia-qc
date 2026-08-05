# Revisor QC · ESENCIA

Revisor de clips para el proyecto ESENCIA. Abres `index.html`, sueltas los clips que
te manda el equipo y el `.srt` del proyecto, revisas segundo a segundo, marcas cada
error con su captura de pantalla y sacas un **informe HTML** que el equipo abre de un
clic (o desde un link, si lo publicas).

Un solo archivo, sin instalar nada, sin servidor. **Los videos nunca salen de tu
computador**: el navegador los lee en local. Lo único que se sube a internet, si tú
lo decides, es el informe.

---

## 1 · Revisar

1. Doble clic en `index.html` (Chrome o Safari).
2. Arrastra encima **todos los clips** (`.mp4`) **y el `.srt` del proyecto**. Los clips
   se ordenan solos por nombre y el SRT se reparte entre ellos.
3. Escribe arriba el **proyecto**, el **cliente** y tu nombre como **revisor**.
4. Video a la izquierda ocupando media pantalla; a la derecha, las cuatro pestañas:

| Pestaña | Para qué |
|---|---|
| **Clips** | Saltar de clip, ver el avance y marcarlos como revisados |
| **Subtítulos** | Las líneas de ese clip. Clic en una línea = saltar ahí. **Clic en una palabra = reportarla al instante** |
| **Errores** | Todo lo que llevas marcado, con su miniatura |
| **Ajustes** | Reparto del SRT, FPS y atajos |

### Segundo a segundo

Debajo del video hay una **cinta de segundos**. Cada celda es un segundo del clip:

- <kbd>G</kbd> marca el segundo como revisado (verde) y salta al siguiente.
- Rojo = ese segundo tiene un error.
- Clic en cualquier celda para saltar ahí.

Cuando la cinta está entera en verde, el clip queda marcado como revisado.

### Marcar un error

Pon el video en el frame exacto y pulsa <kbd>E</kbd> (o el botón **+ Error aquí**).
Se abre la ficha **con la captura de ese frame ya tomada**. Eliges tipo, severidad y
plano (P1 / P2 / P3), escribes qué hay que corregir y listo. El subtítulo que sonaba
en ese punto se guarda solo.

Tipos disponibles: texto de más · palabra faltante · inaudible · sin resaltar ·
resalte incorrecto · encuadre · plano/corte · colorimetría · sync de subtítulo ·
audio · otro.

**Truco:** en la pestaña *Subtítulos*, clic sobre una palabra concreta abre un menú
rápido (*sobra* / *falta* / *debía ir resaltada* / *no se entiende*) y te rellena la
descripción con la palabra dentro. Es la vía rápida para el 80 % de los errores de texto.

### Atajos

| | |
|---|---|
| <kbd>Espacio</kbd> | play / pausa |
| <kbd>←</kbd> <kbd>→</kbd> | un paso (1 frame, 0.25 s, 0.5 s, 1 s o 2 s según el selector) |
| <kbd>Shift</kbd> + <kbd>←</kbd> <kbd>→</kbd> | 5 segundos |
| <kbd>E</kbd> | error nuevo en este frame |
| <kbd>G</kbd> | segundo OK, saltar al siguiente |
| <kbd>S</kbd> | captura suelta (se descarga como .jpg) |
| <kbd>N</kbd> / <kbd>P</kbd> | clip siguiente / anterior |
| <kbd>1</kbd>…<kbd>9</kbd> | error del tipo N directamente |
| <kbd>Esc</kbd> | cerrar ventana |

### Guardar a medias

**Guardar avance** baja un `.json` con todo (errores, capturas y segundos revisados).
Para retomar: abre `index.html`, arrastra otra vez los clips y luego el `.json`
(o pulsa **Abrir avance**). Los videos se reenganchan por nombre de archivo.

---

## 2 · El reparto del SRT

El equipo manda **un solo `.srt`** con los timecodes corridos de toda la secuencia.
El revisor lo trocea solo: el clip 1 se queda con lo que cae dentro de su duración,
el clip 2 empieza donde acaba el 1, y así.

Si algún clip queda sin subtítulos o con los que no son, ve a **Ajustes → Reparto**:

- **Timeline continuo (duración acumulada)** — el modo normal.
- **Timeline continuo (detectar por huecos)** — si entre clip y clip hay silencio en
  la secuencia. Ajusta el "hueco mínimo".
- **Cada clip reinicia en 0** — si el SRT trae los tiempos de cada clip desde cero.
- **Manual** — escribes a mano el IN de cada clip dentro de la secuencia.

Debajo tienes el IN de cada clip y cuántos subtítulos le tocaron: si ves un `0 subs`,
ahí está el problema.

---

## 3 · El informe

**Generar informe** baja un `.html` autocontenido: las capturas van dentro del archivo,
no hay carpetas de imágenes que se pierdan. Funciona con doble clic, sin internet.

Lo que ve el equipo:

- Resumen arriba (total, críticas, medias, menores y tipos más repetidos).
- Una sección por clip, y dentro cada observación con su captura, el timecode del clip
  y el de la secuencia, tipo, severidad, plano y el subtítulo de ese punto.
- **Casilla "Corregido" + nota del editor** en cada punto. Se guarda en su navegador,
  así que pueden cerrar y seguir mañana.
- Filtros (todas / pendientes / corregidas), barra de progreso e **Imprimir / PDF**.
- **Exportar estado** → un `.json` con lo que resolvieron y sus notas, para que te lo
  devuelvan y sepas qué falta sin abrir nada.

Clic en el timecode = se copia al portapapeles, listo para pegarlo en Premiere.

---

## 4 · Publicarlo en GitHub Pages

### Paso 1 — subir el proyecto (solo la primera vez)

Crea un repo vacío en <https://github.com/new> (llámalo `esencia-qc`, **sin** README ni
.gitignore) y luego, en Terminal:

```bash
cd "/ruta/donde/tengas/esencia-qc"      # arrastra la carpeta al Terminal para pegar la ruta
git init -b main
git add .
git commit -m "Revisor QC ESENCIA"
git remote add origin https://github.com/TU-USUARIO/esencia-qc.git
git push -u origin main
```

### Paso 2 — encender Pages

En el repo: **Settings → Pages → Build and deployment → Source: _Deploy from a branch_
→ Branch: `main` / `/ (root)` → Save**. Al minuto tendrás:

- Revisor: `https://TU-USUARIO.github.io/esencia-qc/`
- Informes: `https://TU-USUARIO.github.io/esencia-qc/informes/`

Puedes revisar directamente desde esa URL: los clips los sigue leyendo tu Mac, no se suben.

### Paso 3 — publicar cada informe

Genera el informe en el revisor y **doble clic en `publicar-informe.command`**.
Coge el informe más reciente de Descargas, actualiza el índice, hace push y te deja
**el link ya copiado en el portapapeles**. También puedes arrastrar un `.html`
concreto sobre el script.

> La primera vez macOS puede bloquearlo: **clic derecho → Abrir → Abrir**. Y si dice
> que no tiene permisos, en Terminal: `chmod +x publicar-informe.command`.

### ⚠️ Antes de publicar, léelo

**Un repo público en GitHub Pages es internet abierto.** Los informes llevan capturas
del material del cliente. Cualquiera con el link las ve.

- Hay un `robots.txt` que pide a Google no indexar, pero eso **no es una contraseña**.
- GitHub Pages en repos **privados** existe, pero necesita plan de pago (Pro / Team).
- Si el material es sensible: no publiques. El informe es un archivo suelto que
  funciona igual por Drive, WeTransfer o adjunto en un correo — para eso lo hice
  autocontenido.

Decide caso por caso con cada cliente.

---

## 5 · Si algo falla

| Síntoma | Qué pasa |
|---|---|
| El video no se ve | Códec raro. Prueba en Chrome; si es HEVC/ProRes, exporta el clip a H.264 |
| Un clip sale con `0 subs` | Reparto mal: **Ajustes → Reparto**, prueba otro modo o pon los IN a mano |
| Los subtítulos van desfasados | El SRT no es el de esos clips, o el reparto es otro. Compruébalo en *Ajustes* |
| La captura sale negra | El frame aún no estaba decodificado: pausa, espera medio segundo y vuelve a capturar |
| El informe pesa mucho | Normal: cada captura son ~60-120 KB. 40 errores ≈ 4 MB. GitHub aguanta hasta 100 MB por archivo |
| El equipo perdió sus checks | Se guardan por navegador y por informe. Si cambian de navegador o borran datos, se pierden — por eso está **Exportar estado** |
| `publicar-informe.command` no abre | Clic derecho → Abrir → Abrir. O `chmod +x publicar-informe.command` |

---

## Estructura

```
esencia-qc/
├── index.html                 el revisor (todo está aquí dentro)
├── informes/                  los informes publicados + su índice
├── publicar-informe.command   doble clic para publicar
├── robots.txt                 pide no indexar
├── .gitignore                 impide subir videos por error
└── _test/                     prueba automática (no hace falta para usarlo)
```

Hecho para Juan Pablo Edit · Revisor QC ESENCIA
