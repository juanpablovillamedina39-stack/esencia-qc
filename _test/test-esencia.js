/* Prueba con el paquete real de ESENCIA: .docx de aprobados + 10 SRT pegados + 10 clips */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const RAIZ = path.resolve(__dirname, '..');
const FIX = '/tmp/qc/fix2';
const OUT = '/tmp/qc/salida2';
fs.mkdirSync(OUT, { recursive: true });

const esperado = JSON.parse(fs.readFileSync(path.join(FIX, 'esperado.json'), 'utf8'));

let fallos = 0, ok = 0;
function chk(c, m, x) {
  if (c) { ok++; console.log('  ✓ ' + m); }
  else { fallos++; console.log('  ✗ ' + m + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const errsJS = [];
  page.on('pageerror', e => errsJS.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errsJS.push(m.text()); });

  await page.goto('file://' + path.join(RAIZ, 'index.html'));

  const videos = esperado.meta.map(m => path.join(FIX, m.archivo.replace('.mp4', '.webm')));
  const archivos = videos.concat([path.join(FIX, 'proyecto.srt'), path.join(FIX, 'aprobados.docx')]);

  console.log('\n1. CARGA DEL PAQUETE COMPLETO');
  await page.setInputFiles('#inArchivos', archivos);
  await page.waitForFunction(() => window.QC && QC.S.clips.length === 10, null, { timeout: 40000 });
  await page.waitForTimeout(1500);

  const st = await page.evaluate(() => ({
    clips: QC.S.clips.length,
    doc: QC.S.doc.length,
    docNombre: QC.S.docNombre,
    cues: QC.S.cues.length,
    bloques: QC.S.bloques,
    modo: QC.S.modoReparto,
    archivosDoc: QC.S.doc.map(d => d.archivo),
    ordenDoc: QC.S.doc.map(d => d.orden.length),
    frasesDoc: QC.S.doc.map(d => d.frases.length)
  }));
  chk(st.clips === 10, '10 clips cargados', st.clips);
  chk(st.doc === 10, 'el .docx se leyó: 10 clips en el documento', st.doc);
  chk(st.docNombre === 'aprobados.docx', 'guarda el nombre del doc', st.docNombre);
  chk(st.archivosDoc.every(a => /CLIP \d+\.mp4$/.test(a)), 'C) Título trae el nombre del .mp4 en los 10', st.archivosDoc.slice(0, 2));
  chk(st.ordenDoc.every(n => n > 0), 'B) Orden final leído en los 10', st.ordenDoc);
  chk(st.frasesDoc.filter(n => n > 0).length >= 7, 'A) Frases con timecode leídas', st.frasesDoc);
  chk(st.modo === 'bloques', 'detecta solo el modo «un SRT por clip»', st.modo);
  chk(st.bloques === 10, 'corta el .srt en 10 bloques', st.bloques);

  console.log('\n2. CRUCE video ↔ doc ↔ bloque (el .srt viene DESORDENADO a propósito)');
  console.log('   orden de los bloques dentro del archivo: ' + JSON.stringify(esperado.ordenArchivo));
  const cruce = await page.evaluate(() => QC.S.clips.map(c => ({
    nombre: c.nombre,
    docNum: c.doc ? c.doc.num : null,
    docArch: c.doc ? c.doc.archivo : null,
    docSim: +(c.docSim || 0).toFixed(2),
    bloque: c.bloque,
    coinc: +(c.coinc || 0).toFixed(2),
    nsubs: c.subs.length,
    primera: c.subs.length ? c.subs[0].texto : ''
  })));
  chk(cruce.every(c => c.docNum), 'los 10 clips cruzaron con su clip del doc', cruce.filter(c => !c.docNum).map(c => c.nombre));
  chk(cruce.every(c => c.docArch.replace('.mp4', '.webm') === c.nombre), 'cada video cayó en SU clip del doc, por nombre de archivo',
    cruce.filter(c => c.docArch.replace('.mp4', '.webm') !== c.nombre));
  chk(cruce.every(c => c.docSim >= 0.99), 'el nombre casó al 100 %', cruce.map(c => c.docSim));
  chk(new Set(cruce.map(c => c.bloque)).size === 10, 'cada clip se quedó con un bloque distinto', cruce.map(c => c.bloque));
  chk(cruce.every(c => c.nsubs > 0), 'ningún clip se quedó sin subtítulos', cruce.map(c => c.nsubs));
  chk(cruce.every(c => c.coinc >= 0.75), 'coincidencia de texto alta en los 10', cruce.map(c => c.coinc));

  // el número de cues de cada clip debe ser el que generamos para ese clip
  const esperCues = {};
  esperado.meta.forEach(m => { esperCues[m.archivo.replace('.mp4', '.webm')] = m.ncues; });
  const cuadran = cruce.filter(c => esperCues[c.nombre] === c.nsubs).length;
  chk(cuadran === 10, 'el bloque asignado es exactamente el de ese clip (10/10)',
    cruce.map(c => `${c.nombre.slice(-12)}:${c.nsubs}/${esperCues[c.nombre]}`));

  // y la primera línea tiene que ser la primera del guion de ese clip
  const primOK = await page.evaluate(() => QC.S.clips.every(c => {
    if (!c.doc || !c.subs.length) return false;
    const a = c.subs[0].texto.toLowerCase().split(/\s+/).slice(0, 4).join(' ');
    return c.doc.orden.join(' ').toLowerCase().indexOf(a.split(' ')[0]) >= 0;
  }));
  chk(primOK, 'la primera línea de cada clip pertenece a su guion', primOK);

  console.log('\n3. COTEJO CONTRA EL GUION');
  await page.click('.tab[data-v="subs"]');
  await page.waitForTimeout(400);
  // clip 2 lleva "obviamente" metido a mano; clip 5 lleva "carajo"
  const idx2 = cruce.findIndex(c => /CLIP 2\.webm$/.test(c.nombre));
  await page.evaluate(i => QC.irAClip(i, 0), idx2);
  await page.waitForTimeout(900);
  const fuera2 = await page.evaluate(() => [...document.querySelectorAll('#v-subs .pal.fuera')].map(e => e.textContent.trim()));
  chk(fuera2.includes('obviamente'), 'subraya la palabra de más «obviamente» en el CLIP 2', fuera2);
  chk(fuera2.length <= 6, 'y no subraya media transcripción (pocos falsos positivos)', fuera2);

  const idx5 = cruce.findIndex(c => /CLIP 5\.webm$/.test(c.nombre));
  await page.evaluate(i => QC.irAClip(i, 0), idx5);
  await page.waitForTimeout(900);
  const fuera5 = await page.evaluate(() => [...document.querySelectorAll('#v-subs .pal.fuera')].map(e => e.textContent.trim()));
  chk(fuera5.includes('carajo'), 'subraya «carajo» en el CLIP 5', fuera5);

  const pctTxt = await page.textContent('#v-subs .pill');
  chk(/guion \d+%/.test(pctTxt), 'muestra el % de coincidencia con el guion', pctTxt);

  console.log('\n4. PESTAÑA GUION');
  await page.click('.tab[data-v="guion"]');
  await page.waitForTimeout(300);
  const g = await page.textContent('#v-guion');
  chk(/CLIP \d+ —/.test(g), 'muestra el clip del doc con su título', g.slice(0, 60));
  chk(/B\) Orden final/.test(g) && /A\) Frases fuente/.test(g), 'muestra orden final y frases fuente', null);
  const nOrden = await page.locator('#v-guion .caja').count();
  chk(nOrden >= 3, 'lista los bloques del guion', nOrden);

  console.log('\n5. SYNC POR CLIP');
  await page.click('.tab[data-v="subs"]');
  await page.waitForTimeout(300);
  const tcAntes = await page.locator('#v-subs .sub').first().locator('.tc span').first().textContent();
  await page.evaluate(() => { document.getElementById('video').currentTime = 3.0; });
  await page.waitForTimeout(700);
  await page.locator('#v-subs [data-cal="0"]').first().click({ force: true });
  await page.waitForTimeout(500);
  const sync = await page.evaluate(i => QC.S.clips[i].sync, idx5);
  chk(Math.abs(sync - (3.0 - 0.6)) < 0.15, '⌖ calibra el sync del clip con el video', sync);
  const tcDespues = await page.locator('#v-subs .sub').first().locator('.tc span').first().textContent();
  chk(tcDespues !== tcAntes && /00:00:03:/.test(tcDespues), 'los timecodes mostrados se corren con el sync', { tcAntes, tcDespues });
  const subAhora = await page.textContent('#subOverlay');
  chk(subAhora.length > 5, 'y el subtítulo se ve encima del video en ese punto', subAhora.slice(0, 40));
  // dejarlo a 0 otra vez
  await page.evaluate(i => { QC.S.clips[i].sync = 0; }, idx5);

  console.log('\n6. ERROR + INFORME CON EL PAQUETE REAL');
  await page.evaluate(i => QC.irAClip(i, 4.0), idx2);
  await page.waitForTimeout(900);
  await page.click('#bError');
  await page.waitForSelector('#modal #mDesc');
  await page.selectOption('#mTipo', 'texto_mas');
  await page.fill('#mDesc', 'Sobra «obviamente», no lo dice.');
  await page.click('#mOk');
  await page.waitForTimeout(400);

  const dl = page.waitForEvent('download');
  await page.click('#bInforme');
  const d = await dl;
  const ruta = path.join(OUT, d.suggestedFilename());
  await d.saveAs(ruta);
  const html = fs.readFileSync(ruta, 'utf8');
  chk(html.includes('data:image/jpeg;base64'), 'informe con la captura incrustada', null);
  chk(html.includes('CLIP 2'), 'el informe nombra el clip real', null);
  chk(!/seq 00:00:00:00/.test(html), 'no imprime el «seq» cuando no aplica', null);

  const p2 = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errInf = [];
  p2.on('pageerror', e => errInf.push(e.message));
  await p2.goto('file://' + ruta);
  await p2.waitForTimeout(400);
  chk(await p2.locator('article.err').count() === 1, 'el informe abre bien', null);
  chk(await p2.locator('section.clip').count() === 10, 'una sección por cada uno de los 10 clips', null);
  chk(await p2.locator('.ok-tag').count() === 9, '9 clips sin observaciones', null);
  chk(errInf.length === 0, 'informe sin errores de JS', errInf);

  console.log('\n7. GUARDAR Y REABRIR CON DOC');
  const dlAv = page.waitForEvent('download');
  await page.click('#bGuardar');
  const av = await dlAv;
  const rutaAv = path.join(OUT, 'avance.json');
  await av.saveAs(rutaAv);

  const p3 = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const errP3 = [];
  p3.on('pageerror', e => errP3.push(e.message));
  await p3.goto('file://' + path.join(RAIZ, 'index.html'));
  await p3.setInputFiles('#inArchivos', videos);
  await p3.waitForFunction(() => window.QC && QC.S.clips.length === 10, null, { timeout: 40000 });
  await p3.setInputFiles('#inAvance', [rutaAv]);
  await p3.waitForTimeout(1600);
  const rec = await p3.evaluate(() => ({
    clips: QC.S.clips.length, doc: QC.S.doc.length,
    conDoc: QC.S.clips.filter(c => c.doc).length,
    conSubs: QC.S.clips.filter(c => c.subs.length).length,
    errs: QC.todosLosErrores().length
  }));
  chk(rec.doc === 10 && rec.conDoc === 10, 'el avance conserva el cruce con el doc', rec);
  chk(rec.conSubs === 10 && rec.errs === 1, 'y los subtítulos y el error', rec);
  chk(errP3.length === 0, 'sin errores de JS al reabrir', errP3);

  console.log('\n8. CONSOLA');
  chk(errsJS.length === 0, 'sin errores de JS en toda la sesión', errsJS.slice(0, 4));

  await page.click('.tab[data-v="subs"]');
  await page.screenshot({ path: path.join(OUT, 'revisor-esencia.png') });
  await page.click('.tab[data-v="guion"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'guion-esencia.png') });

  await browser.close();
  console.log('\n══════════════════════════════');
  console.log(`  ${ok} OK · ${fallos} fallo(s)`);
  console.log('══════════════════════════════\n');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('EXPLOTÓ:', e); process.exit(2); });
