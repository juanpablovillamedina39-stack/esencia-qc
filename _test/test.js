/* Prueba end-to-end del Revisor QC — no forma parte del entregable */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const RAIZ = path.resolve(__dirname, '..');
const FIX  = '/tmp/qc/fixtures';
const OUT  = '/tmp/qc/salida';
fs.mkdirSync(OUT, { recursive: true });

let fallos = 0, ok = 0;
function chk(cond, msg, extra) {
  if (cond) { ok++; console.log('  ✓ ' + msg); }
  else { fallos++; console.log('  ✗ ' + msg + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });

  const errsConsola = [];
  page.on('console', m => { if (m.type() === 'error') errsConsola.push(m.text()); });
  page.on('pageerror', e => errsConsola.push('PAGEERROR: ' + e.message));

  await page.goto('file://' + path.join(RAIZ, 'index.html'));

  console.log('\n1. CARGA DE ARCHIVOS');
  await page.setInputFiles('#inArchivos', [
    path.join(FIX, 'reel01.webm'), path.join(FIX, 'reel02.webm'),
    path.join(FIX, 'reel03.webm'), path.join(FIX, 'proyecto.srt')
  ]);
  await page.waitForFunction(() => window.QC && window.QC.S.clips.length === 3, null, { timeout: 20000 });
  await page.waitForTimeout(600);

  const st = await page.evaluate(() => ({
    nClips: QC.S.clips.length,
    nCues: QC.S.cues.length,
    modo: QC.S.modoReparto,
    durs: QC.S.clips.map(c => +c.dur.toFixed(2)),
    inicios: QC.S.clips.map(c => +c.inicio.toFixed(2)),
    subsPorClip: QC.S.clips.map(c => c.subs.length),
    nombres: QC.S.clips.map(c => c.nombre),
    primerSub: QC.S.clips[0].subs[0],
    subC2: QC.S.clips[1].subs[0]
  }));
  chk(st.nClips === 3, '3 clips cargados', st.nClips);
  chk(st.nCues === 13, '13 cues leídos del SRT', st.nCues);
  chk(st.modo === 'acumulado', 'modo detectado = timeline continuo', st.modo);
  chk(JSON.stringify(st.subsPorClip) === '[4,6,3]', 'reparto 4/6/3 subtítulos', st.subsPorClip);
  chk(st.inicios[1] > 11.9 && st.inicios[1] < 12.1, 'IN del clip 2 ≈ 12 s', st.inicios);
  chk(Math.abs(st.primerSub.ini - 0.5) < 0.01, 'primer sub del clip 1 en 0.5 s', st.primerSub);
  chk(Math.abs(st.subC2.ini - 0.392) < 0.02, 'sub del clip 2 rebasado a tiempo local', st.subC2);
  chk(st.nombres.join() === 'reel01.webm,reel02.webm,reel03.webm', 'orden natural de clips', st.nombres);

  console.log('\n2. LAYOUT (video a mitad de pantalla)');
  const caja = await page.evaluate(() => {
    const izq = document.getElementById('izq').getBoundingClientRect();
    const v = document.getElementById('video').getBoundingClientRect();
    return { izq: izq.width, total: window.innerWidth, videoVisible: v.width > 0 && v.height > 0, vh: v.height };
  });
  chk(Math.abs(caja.izq - caja.total / 2) < 2, 'columna del video ocupa el 50%', caja);
  chk(caja.videoVisible, 'el video se ve', caja);

  console.log('\n3. NAVEGACIÓN Y SUBTÍTULOS');
  await page.evaluate(() => { const v = document.getElementById('video'); v.currentTime = 4.0; });
  await page.waitForFunction(() => Math.abs(document.getElementById('video').currentTime - 4.0) < 0.3, null, { timeout: 8000 });
  await page.waitForTimeout(300);
  const ov = await page.textContent('#subOverlay');
  chk(/disciplina/.test(ov), 'overlay muestra el subtítulo correcto en 4 s', ov);
  const tc = await page.textContent('#tcGrande');
  chk(/^00:00:04:/.test(tc), 'timecode HH:MM:SS:FF correcto', tc);

  await page.click('.tab[data-v="subs"]');
  const nSubsDom = await page.locator('#v-subs .sub').count();
  chk(nSubsDom === 4, 'panel de subtítulos lista 4 líneas del clip 1', nSubsDom);
  const activo = await page.locator('#v-subs .sub.act').count();
  chk(activo === 1, 'la línea en curso queda marcada', activo);

  console.log('\n4. PASO Y CINTA DE SEGUNDOS');
  await page.selectOption('#fPaso', '1');
  const t0 = await page.evaluate(() => document.getElementById('video').currentTime);
  await page.click('#bAdelante');
  await page.waitForTimeout(400);
  const t1 = await page.evaluate(() => document.getElementById('video').currentTime);
  chk(Math.abs((t1 - t0) - 1) < 0.15, 'paso de 1 s adelante', { t0, t1 });
  await page.selectOption('#fPaso', 'frame');
  await page.click('#bAtras');
  await page.waitForTimeout(400);
  const t2 = await page.evaluate(() => document.getElementById('video').currentTime);
  chk(Math.abs((t1 - t2) - 1 / 30) < 0.02, 'paso de 1 frame atrás', { t1, t2 });

  const segs = await page.locator('#cinta .seg').count();
  chk(segs === 12, 'cinta con 12 celdas de segundo para el clip 1', segs);
  await page.click('#bSegOk');
  await page.waitForTimeout(300);
  const cinta = await page.evaluate(() => ({ ok: QC.S.clips[0].segsOk, t: document.getElementById('video').currentTime }));
  chk(cinta.ok.length === 1, 'marca el segundo como revisado', cinta);
  chk(Math.abs(cinta.t - (cinta.ok[0] + 1)) < 0.2, 'salta al segundo siguiente', cinta);

  console.log('\n5. CAPTURA DEL FRAME');
  await page.evaluate(() => { document.getElementById('video').currentTime = 6.5; });
  await page.waitForTimeout(600);
  const cap = await page.evaluate(() => {
    const d = QC.capturarFrame();
    if (!d) return { ok: false };
    return { ok: true, largo: d.length, jpeg: d.startsWith('data:image/jpeg') };
  });
  chk(cap.ok && cap.jpeg && cap.largo > 3000, 'capturarFrame() devuelve un JPEG con contenido', cap);
  const colorOk = await page.evaluate(async () => {
    const d = QC.capturarFrame();
    const img = new Image(); img.src = d;
    await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    const p = c.getContext('2d').getImageData(Math.floor(img.width / 2), Math.floor(img.height / 2), 1, 1).data;
    return { r: p[0], g: p[1], b: p[2], w: img.width };
  });
  chk(colorOk.b > 60 && colorOk.b > colorOk.r, 'la captura tiene el color real del clip 1 (azulado)', colorOk);
  chk(colorOk.w <= 720 && colorOk.w > 100, 'captura reescalada a máx 720 px', colorOk);

  console.log('\n6. MARCAR ERRORES');
  // error 1 · por el botón + modal
  await page.click('#bError');
  await page.waitForSelector('#modal #mDesc');
  chk(await page.locator('#modalCap').count() === 1, 'el modal abre con la captura tomada', null);
  await page.selectOption('#mTipo', 'encuadre');
  await page.selectOption('#mSev', 'critico');
  await page.selectOption('#mPlano', 'P2');
  await page.fill('#mDesc', 'La cabeza queda cortada al entrar el plano 2.');
  await page.click('#mOk');
  await page.waitForTimeout(300);
  chk(await page.evaluate(() => QC.S.clips[0].errores.length) === 1, 'error añadido al clip 1', null);

  // error 2 · clic en una palabra del subtítulo
  await page.click('.tab[data-v="subs"]');
  await page.evaluate(() => { document.getElementById('video').currentTime = 4.0; });
  await page.waitForTimeout(500);
  const pal = page.locator('#v-subs .sub').nth(1).locator('.pal', { hasText: 'disciplina' }).first();
  await pal.click();
  await page.waitForSelector('#modal button[data-t="sin_resalte"]', { timeout: 5000 });
  await page.click('#modal button[data-t="sin_resalte"]');
  await page.waitForSelector('#modal #mDesc');
  const descPre = await page.inputValue('#mDesc');
  chk(/disciplina/.test(descPre) && /resaltada/.test(descPre), 'clic en palabra prerrellena la descripción', descPre);
  await page.click('#mOk');
  await page.waitForTimeout(300);

  // error 3 · en otro clip
  await page.click('.tab[data-v="clips"]');
  await page.locator('.clip').nth(1).click();
  await page.waitForTimeout(900);
  await page.evaluate(() => { document.getElementById('video').currentTime = 5.0; });
  await page.waitForTimeout(700);
  await page.keyboard.press('e');
  await page.waitForSelector('#modal #mDesc');
  await page.selectOption('#mTipo', 'color');
  await page.selectOption('#mSev', 'medio');
  await page.fill('#mDesc', 'El plano 3 viene más frío que los otros dos.');
  await page.click('#mOk');
  await page.waitForTimeout(300);

  const errTot = await page.evaluate(() => QC.todosLosErrores().map(e => ({ clip: e.clip.nombre, tipo: e.tipo, cap: !!e.captura, cita: e.cita })));
  chk(errTot.length === 3, '3 errores en total', errTot.length);
  chk(errTot.every(e => e.cap), 'los 3 llevan captura', errTot.map(e => e.cap));
  chk(errTot[1].cita.length > 0, 'el error guarda el subtítulo de ese punto', errTot[1].cita);
  chk(errTot[2].clip === 'reel02.webm', 'el 3.º quedó en el clip 2', errTot[2].clip);
  chk(await page.textContent('#nErrs') === '3', 'el contador de la pestaña marca 3', null);

  console.log('\n7. GUARDAR Y REABRIR AVANCE');
  const dlAv = page.waitForEvent('download');
  await page.click('#bGuardar');
  const av = await dlAv;
  const rutaAv = path.join(OUT, 'avance.json');
  await av.saveAs(rutaAv);
  const jsonAv = JSON.parse(fs.readFileSync(rutaAv, 'utf8'));
  chk(jsonAv.clips.length === 3 && jsonAv.clips[0].errores.length === 2, 'el avance guarda clips y errores', {
    clips: jsonAv.clips.length, e0: jsonAv.clips[0].errores.length
  });
  chk(!!jsonAv.clips[0].errores[0].captura, 'el avance incluye las capturas', null);

  console.log('\n8. INFORME HTML');
  const dl = page.waitForEvent('download');
  await page.click('#bInforme');
  const d = await dl;
  const ruta = path.join(OUT, d.suggestedFilename());
  await d.saveAs(ruta);
  const htmlInf = fs.readFileSync(ruta, 'utf8');
  chk(/^informe_.*\.html$/.test(d.suggestedFilename()), 'nombre del informe correcto', d.suggestedFilename());
  chk(htmlInf.includes('data:image/jpeg;base64'), 'las capturas van incrustadas en base64', null);
  chk(!/<\/script>\s*<\/script>/.test(htmlInf), 'sin scripts rotos', null);
  console.log('  · tamaño del informe: ' + (fs.statSync(ruta).size / 1024).toFixed(0) + ' KB');

  const p2 = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errInf = [];
  p2.on('pageerror', e => errInf.push(e.message));
  p2.on('console', m => { if (m.type() === 'error') errInf.push(m.text()); });
  await p2.goto('file://' + ruta);
  await p2.waitForTimeout(500);

  chk(await p2.locator('article.err').count() === 3, 'el informe muestra las 3 observaciones', await p2.locator('article.err').count());
  chk(await p2.locator('section.clip').count() === 3, 'una sección por clip', null);
  chk(await p2.locator('.ok-tag').count() === 1, 'el clip sin errores sale como «Sin observaciones»', null);
  const imgsOk = await p2.evaluate(() => [...document.querySelectorAll('.izq img')].every(i => i.naturalWidth > 50));
  chk(imgsOk, 'las capturas se ven en el informe', null);
  chk((await p2.textContent('#progTxt')).includes('0 de 3'), 'progreso inicial 0 de 3', await p2.textContent('#progTxt'));

  // marcar corregido + nota
  await p2.locator('input.hecho').first().check();
  await p2.locator('.nota').first().fill('Reencuadrado y reexportado');
  await p2.waitForTimeout(250);
  chk((await p2.textContent('#progTxt')).includes('1 de 3'), 'al marcar corregido sube el progreso', await p2.textContent('#progTxt'));
  chk(await p2.locator('article.err.resuelto').count() === 1, 'la tarjeta se marca como hecha', null);

  // filtro pendientes
  await p2.click('[data-f="pend"]');
  await p2.waitForTimeout(200);
  chk(await p2.locator('article.err:not(.oculto)').count() === 2, 'filtro «pendientes» deja 2', null);
  await p2.click('[data-f="todos"]');

  // persistencia
  await p2.reload();
  await p2.waitForTimeout(500);
  chk(await p2.locator('input.hecho').first().isChecked(), 'el estado sobrevive al recargar', null);
  chk(await p2.locator('.nota').first().inputValue() === 'Reencuadrado y reexportado', 'la nota también', null);

  // export de estado
  const dl2 = p2.waitForEvent('download');
  await p2.click('#bExport');
  const d2 = await dl2;
  const rutaEst = path.join(OUT, d2.suggestedFilename());
  await d2.saveAs(rutaEst);
  const est = JSON.parse(fs.readFileSync(rutaEst, 'utf8'));
  chk(est.items.length === 3 && est.items.filter(i => i.corregido).length === 1, 'el estado exportado cuadra', {
    n: est.items.length, hechos: est.items.filter(i => i.corregido).length
  });
  chk(est.items[0].nota === 'Reencuadrado y reexportado', 'la nota viaja en el export', est.items[0].nota);
  chk(!!est.items[0].tc && !!est.items[0].tipo, 'el export lleva timecode y tipo', est.items[0]);

  console.log('\n9. REABRIR AVANCE EN SESIÓN LIMPIA');
  const p3 = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const errP3 = [];
  p3.on('pageerror', e => errP3.push(e.message));
  await p3.goto('file://' + path.join(RAIZ, 'index.html'));
  await p3.setInputFiles('#inArchivos', [path.join(FIX, 'reel01.webm'), path.join(FIX, 'reel02.webm'), path.join(FIX, 'reel03.webm')]);
  await p3.waitForFunction(() => window.QC && QC.S.clips.length === 3, null, { timeout: 20000 });
  await p3.setInputFiles('#inAvance', [rutaAv]);
  await p3.waitForTimeout(1200);
  const rec = await p3.evaluate(() => ({
    clips: QC.S.clips.length,
    errs: QC.todosLosErrores().length,
    conUrl: QC.S.clips.filter(c => c.url).length,
    subs: QC.S.clips.map(c => c.subs.length),
    segs: QC.S.clips[0].segsOk.length
  }));
  chk(rec.clips === 3 && rec.errs === 3, 'avance reabierto con sus 3 errores', rec);
  chk(rec.conUrl === 3, 'reengancha los videos por nombre', rec);
  chk(JSON.stringify(rec.subs) === '[4,6,3]', 'conserva el reparto de subtítulos', rec.subs);
  chk(rec.segs === 1, 'conserva los segundos revisados', rec.segs);
  chk(errP3.length === 0, 'sin errores de JS al reabrir', errP3);

  console.log('\n10. MODOS ALTERNATIVOS DE REPARTO');
  const modos = await p3.evaluate(() => {
    const r = {};
    QC.S.modoReparto = 'huecos'; QC.S.umbralHueco = 0.5; QC.repartir();
    r.huecos = QC.S.clips.map(c => c.subs.length);
    QC.S.modoReparto = 'acumulado'; QC.repartir();
    r.acumulado = QC.S.clips.map(c => c.subs.length);
    return r;
  });
  chk(JSON.stringify(modos.acumulado) === '[4,6,3]', 'vuelve al reparto acumulado', modos);
  console.log('  · por huecos (umbral 0.5 s): ' + JSON.stringify(modos.huecos));

  console.log('\n11. CASOS LÍMITE');
  const lim = await p3.evaluate(() => {
    const r = {};
    // SRT sucio: BOM, CRLF, etiquetas, bloque sin número, línea partida en dos
    const sucio = '﻿1\r\n00:00:01,000 --> 00:00:02,500\r\n<i>hola</i> {\\an8}mundo\r\n\r\n' +
                  '00:00:03,000 --> 00:00:04,000\r\ndos\nlíneas\r\n\r\n' +
                  '3\r\n00:00:05,000 --> 00:00:06,000\r\n\r\n' +   // vacío: se descarta
                  '4\r\n1:00:07,000 --> 1:00:08,000\r\ncon hora\r\n';
    const c = QC.parseSubs(sucio);
    r.n = c.length;
    r.limpio = c[0].texto;
    r.multilinea = c[1].texto.indexOf('\n') > 0;
    r.conHora = c[2].ini;
    // informe sin ningún error
    const errs = QC.S.clips.map(c2 => c2.errores);
    QC.S.clips.forEach(c2 => c2.errores = []);
    const inf = QC.construirInforme();
    r.infoVacio = inf.html.length > 2000 && inf.html.indexOf('Sin observaciones') > 0;
    QC.S.clips.forEach((c2, i) => c2.errores = errs[i]);
    // modo reinicio
    QC.S.modoReparto = 'reinicio'; QC.repartir();
    r.reinicio = QC.S.clips.map(c2 => c2.subs.length);
    QC.S.modoReparto = 'acumulado'; QC.repartir();
    // clip sin subtítulos -> mensaje en el panel
    const guarda = QC.S.clips[0].subs;
    QC.S.clips[0].subs = [];
    QC.irAClip(0);
    r.mensajeVacio = document.getElementById('v-subs').textContent.indexOf('no tiene subtítulos') > 0;
    QC.S.clips[0].subs = guarda; QC.irAClip(0);
    return r;
  });
  chk(lim.n === 3, 'SRT sucio: 3 cues útiles (descarta el vacío)', lim.n);
  chk(lim.limpio === 'hola mundo', 'limpia etiquetas <i> y {\\an8}', lim.limpio);
  chk(lim.multilinea, 'respeta el salto de línea dentro de un cue', lim.multilinea);
  chk(Math.abs(lim.conHora - 3607) < 0.01, 'lee timecodes con hora (1:00:07)', lim.conHora);
  chk(lim.infoVacio, 'genera informe aunque no haya errores', lim.infoVacio);
  chk(JSON.stringify(lim.reinicio) === '[13,0,0]', 'modo «reinicia en 0» agrupa por retroceso de tiempo', lim.reinicio);
  chk(lim.mensajeVacio, 'avisa cuando un clip se queda sin subtítulos', lim.mensajeVacio);

  console.log('\n12. CONSOLA');
  chk(errsConsola.length === 0, 'sin errores de JS en el revisor', errsConsola.slice(0, 4));
  chk(errInf.length === 0, 'sin errores de JS en el informe', errInf.slice(0, 4));

  await page.screenshot({ path: path.join(OUT, 'revisor.png') });
  await p2.screenshot({ path: path.join(OUT, 'informe.png'), fullPage: true });

  await browser.close();
  console.log('\n══════════════════════════════');
  console.log(`  ${ok} OK · ${fallos} fallo(s)`);
  console.log('══════════════════════════════\n');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('EXPLOTÓ:', e); process.exit(2); });
