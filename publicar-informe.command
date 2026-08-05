#!/bin/bash
# ============================================================
#  Publicar informe  ·  Revisor QC ESENCIA
#  Doble clic. Coge el informe más nuevo de Descargas, lo mete
#  en el repo, regenera el índice y lo sube a GitHub Pages.
#  También puedes arrastrar un .html sobre este archivo.
# ============================================================
cd "$(dirname "$0")" || exit 1
set -u

AZUL=$'\033[1;36m'; VERDE=$'\033[1;32m'; ROJO=$'\033[1;31m'; GRIS=$'\033[0;90m'; FIN=$'\033[0m'
echo ""
echo "${AZUL}══ PUBLICAR INFORME · Revisor QC ESENCIA ══${FIN}"
echo ""

morir(){ echo "${ROJO}✗ $1${FIN}"; echo ""; echo "Pulsa Intro para cerrar."; read -r _; exit 1; }

command -v git >/dev/null 2>&1 || morir "No tienes git. Instálalo con: xcode-select --install"
[ -d .git ] || morir "Esta carpeta no es un repositorio git todavía. Mira el README (paso 1)."
git remote get-url origin >/dev/null 2>&1 || morir "No hay 'origin' configurado. Mira el README (paso 2)."

# ---------- 1. localizar el informe ----------
ORIGEN="${1:-}"
if [ -z "$ORIGEN" ]; then
  ORIGEN=$(ls -t "$HOME/Downloads"/informe_*.html 2>/dev/null | head -1)
fi
[ -n "$ORIGEN" ] && [ -f "$ORIGEN" ] || morir "No encontré ningún informe_*.html en Descargas. Genera uno desde el revisor, o arrastra el archivo sobre este script."

NOMBRE=$(basename "$ORIGEN")
mkdir -p informes
cp "$ORIGEN" "informes/$NOMBRE" || morir "No pude copiar el informe."
TAM=$(du -h "informes/$NOMBRE" | cut -f1)
echo "  informe:  ${VERDE}$NOMBRE${FIN}  ($TAM)"

# ---------- 2. regenerar el índice ----------
{
cat <<'CAB'
<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Informes de revisión · ESENCIA</title>
<style>
:root{--bg:#0d1117;--bg2:#151d27;--linea:#28323f;--txt:#e6edf3;--txt2:#93a1b1;--azul:#14a9ff}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--txt);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:44px 20px}
.wrap{max-width:760px;margin:0 auto}
small{display:block;font-size:12px;font-weight:700;letter-spacing:2px;color:var(--azul);text-transform:uppercase;margin-bottom:6px}
h1{font-size:27px;margin-bottom:6px}
p.sub{color:var(--txt2);font-size:14px;margin-bottom:28px}
a.item{display:flex;align-items:center;gap:14px;background:var(--bg2);border:1px solid var(--linea);border-radius:12px;padding:15px 18px;margin-bottom:10px;text-decoration:none;color:var(--txt);transition:.15s}
a.item:hover{border-color:var(--azul);transform:translateX(3px)}
a.item b{flex:1;font-size:15px;font-weight:600}
a.item span{color:var(--txt2);font-size:13px;font-family:ui-monospace,monospace}
a.item i{color:var(--azul);font-style:normal}
.vacio{color:var(--txt2);text-align:center;padding:40px;border:1px dashed var(--linea);border-radius:12px}
footer{color:#63738a;font-size:12px;margin-top:30px;text-align:center}
</style></head><body><div class="wrap">
<small>Revisor QC · ESENCIA</small>
<h1>Informes de revisión</h1>
<p class="sub">Abre el informe, marca cada punto como corregido y exporta el estado al terminar.</p>
CAB

CUENTA=0
ls -t informes/*.html 2>/dev/null | while IFS= read -r f; do
  B=$(basename "$f")
  [ "$B" = "index.html" ] && continue
  CUENTA=$((CUENTA+1))
  FECHA=$(echo "$B" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
  [ -z "$FECHA" ] && FECHA=$(date "+%Y-%m-%d")
  TITULO=$(echo "$B" | sed -e 's/^informe_//' -e 's/\.html$//' -e "s/_${FECHA}//" -e 's/[-_]/ /g')
  PESO=$(du -h "$f" | cut -f1 | tr -d ' ')
  echo "<a class=\"item\" href=\"$B\"><i>▸</i><b>$TITULO</b><span>$FECHA · $PESO</span></a>"
done

N=$(ls informes/*.html 2>/dev/null | grep -cv '/index\.html$')
[ "${N:-0}" = "0" ] && echo '<div class="vacio">Todavía no hay informes publicados.</div>'

echo "<footer>Actualizado el $(date '+%d/%m/%Y a las %H:%M')</footer>"
echo '</div></body></html>'
} > informes/index.html

echo "  índice:   ${VERDE}regenerado${FIN}"

# ---------- 3. subir ----------
git add informes/ >/dev/null 2>&1
if git diff --cached --quiet 2>/dev/null; then
  echo "${GRIS}  (no había nada nuevo que subir)${FIN}"
else
  git commit -q -m "Informe: $NOMBRE" || morir "El commit falló."
  RAMA=$(git rev-parse --abbrev-ref HEAD)
  echo "  subiendo a ${AZUL}$RAMA${FIN}…"
  git push -q origin "$RAMA" || morir "El push falló. ¿Estás autenticado en GitHub? Prueba: git push origin $RAMA"
fi

# ---------- 4. enlace ----------
URL=$(git remote get-url origin)
REPO=$(basename "$URL" .git)
USUARIO=$(basename "$(dirname "$URL")" | sed 's/.*://')
LINK="https://${USUARIO}.github.io/${REPO}/informes/${NOMBRE}"

echo ""
echo "${VERDE}✓ Listo.${FIN} GitHub Pages tarda ~1 minuto en refrescar."
echo ""
echo "  Enlace para el equipo:"
echo "  ${AZUL}${LINK}${FIN}"
echo ""
echo "  Índice de todos los informes:"
echo "  ${AZUL}https://${USUARIO}.github.io/${REPO}/informes/${FIN}"
echo ""
printf "%s" "$LINK" | pbcopy 2>/dev/null && echo "${GRIS}  (el enlace ya está en tu portapapeles)${FIN}"
echo ""
echo "Pulsa Intro para cerrar."
read -r _
