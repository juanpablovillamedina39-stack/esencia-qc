/* Prueba con el paquete REAL de Piti Pinsach:
   .srt de la secuencia entera (34 min, timeline continuo, con <font color> de resalte)
   + .docx de 30 clips aprobados, de los que solo 15 estan montados. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const RAIZ = path.resolve(__dirname, '..');
const FIX = '/tmp/qc/fix3';
const OUT = '/tmp/qc/salida3';
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

  const videos = esperado.map(m => path.join(FIX, m.archivo + '.webm'));

  console.log('\n1. CARGA (15 clips - .srt de 34 min - doc de 30 clips)');
  const t0 = Date.now();
  await page.setInputFiles('#inArchivos', videos.concat([
    path.join(FIX, 'proyecto.srt'), path.join(FIX, 'ESENCIA_Piti_Pinsach_editor_aprobados.docx')
  ]));
  await page.waitForFunction(() => window.QC && QC.S.clips.length === 15, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  console.log('   (tardo ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s en cargar y alinear)');

  const st = await page.evaluate(() => ({
    clips: QC.S.clips.length, doc: QC.S.doc.length, cues: QC.S.cues.length,
    modo: QC.S.modoReparto, bloques: QC.S.bloques, color: QC.S.colorResalte,
    docArch: QC.S.doc.slice(0, 2).map(d => d.archivo)
  }));
  chk(st.clips === 15, '15 clips cargados', st.clips);
  chk(st.doc === 30, 'el doc trae 30 clips', st.doc);
  chk(st.cues === 1136, 'el .srt trae 1136 lineas', st.cues);
  chk(st.modo === 'guion', 'con documento cambia solo al modo alinear con el guion', st.modo);
  chk(!/\.mp4$/.test(st.docArch[0]), 'este doc trae el C) Titulo SIN extension (distinto al de Casiel)', st.docArch);
  chk(st.color.toLowerCase() === '#009df9', 'detecta el color de resalte del .srt', st.color);
  chk(st.bloques >= 14 && st.bloques <= 17, 'localiza ~15 clips dentro del .srt', st.bloques);

  console.log('\n2. CADA VIDEO CON SU TEXTO');
  const cruce = await page.evaluate(() => QC.S.clips.map(c => ({
    nombre: c.nombre, docNum: c.doc ? c.doc.num : null, docSim: +(c.docSim || 0).toFixed(2),
    nsubs: c.subs.length, coinc: +(c.coinc || 0).toFixed(2), inicio: +c.inicio.toFixed(1),
    dur: +c.dur.toFixed(1), ultimoSub: c.subs.length ? +c.subs[c.subs.length - 1].fin.toFixed(1) : -1
  })));
  const esp = {};
  esperado.forEach(m => { esp[m.archivo] = m; });
  chk(cruce.every(c => c.docNum), 'los 15 cruzaron con su clip del doc', cruce.filter(c => !c.docNum).map(c => c.nombre));
  chk(cruce.every(c => c.docSim >= 0.99), 'el nombre del archivo caso al 100 %', cruce.map(c => c.docSim));
  chk(cruce.every(c => c.nsubs > 0), 'ninguno se quedo sin subtitulos', cruce.map(c => c.nsubs));

  const bien = cruce.filter(c => {
    const e = esp[c.nombre.replace('.webm', '')];
    return e && c.docNum === e.num && Math.abs(c.nsubs - e.ncues) <= 3;
  }).length;
  chk(bien === 15, 'los 15 se quedaron con SU tramo del .srt (mas/menos 3 lineas)',
    cruce.map(c => { const e = esp[c.nombre.replace('.webm', '')]; return 'CLIP' + c.docNum + '/' + (e ? e.num : '?') + ':' + c.nsubs + '/' + (e ? e.ncues : '?'); }));

  const rebasado = cruce.every(c => c.ultimoSub <= c.dur + 1.5);
  chk(rebasado, 'los tiempos se rebasan al arranque del clip (caben dentro del video)',
    cruce.map(c => c.ultimoSub + '/' + c.dur));
  chk(cruce.filter(c => c.inicio > 5).length >= 13, 'guarda el punto de la secuencia del que salio cada clip',
    cruce.map(c => c.inicio));
  chk(cruce.every(c => c.coinc >= 0.55), 'coincidencia con el guion alta en todos', cruce.map(c => c.coinc));

  console.log('\n3. RESALTE QUE TRAE EL .SRT');
  const idxHL = await page.evaluate(() => {
    let mejor = 0, ms = -1;
    QC.S.clips.forEach((c, i) => {
      const n = c.subs.filter(s => (s.partes || []).some(p => p.hl && p.t.trim().split(/\s+/).length > 1)).length;
      if (n > ms) { ms = n; mejor = i; }
    });
    return mejor;
  });
  await page.evaluate(i => QC.irAClip(i, 5), idxHL);
  await page.waitForTimeout(1000);
  await page.click('.tab[data-v="subs"]');
  await page.waitForTimeout(500);
  await page.evaluate(i => { window.__i = i; }, idxHL);
  const hl = await page.evaluate(() => {
    const c = QC.S.clips[window.__i];
    const total = QC.S.clips.reduce((a, x) => a + x.subs.filter(s => (s.partes || []).some(p => p.hl)).length, 0);
    return {
      enDom: document.querySelectorAll('#v-subs .pal.hl').length,
      conResalte: c.subs.filter(s => (s.partes || []).some(p => p.hl)).length,
      totalTodos: total
    };
  });
  chk(hl.enDom > 0, 'las palabras resaltadas se pintan en color en el panel', hl.enDom);
  chk(hl.conResalte > 0, 'ese clip tiene lineas con resalte', hl.conResalte);
  chk(hl.totalTodos >= 80, 'en total se conservan los ~98 resaltes del .srt', hl.totalTodos);

  const badges = await page.textContent('#v-subs .caja');
  chk(/con resalte/.test(badges), 'muestra el contador de resaltes', badges.replace(/\s+/g, ' ').slice(0, 130));
  chk(/mas de 1 palabra|más de 1 palabra|racha de/.test(badges), 'avisa de los resaltes que rompen la regla ESENCIA', badges.replace(/\s+/g, ' ').slice(0, 130));
  const avisos = await page.locator('#v-subs .sub .aviso').count();
  chk(avisos > 0, 'marca las lineas concretas que incumplen', avisos);

  const overlay = await page.evaluate(() => {
    const c = QC.S.clips[window.__i];
    const s = c.subs.find(x => (x.partes || []).some(p => p.hl));
    document.getElementById('video').currentTime = (s.ini + s.fin) / 2;
    return new Promise(r => setTimeout(() => r(document.getElementById('subOverlay').innerHTML), 800));
  });
  chk(/color:#009df9/i.test(overlay), 'el resalte tambien se ve encima del video', overlay.slice(0, 120));

  console.log('\n4. COTEJO CONTRA EL GUION');
  const cot = await page.evaluate(() => {
    const fuera = document.querySelectorAll('#v-subs .pal.fuera').length;
    const tot = document.querySelectorAll('#v-subs .pal').length;
    return { fuera: fuera, tot: tot, pct: Math.round(fuera / Math.max(1, tot) * 100) };
  });
  chk(cot.pct < 35, 'el cotejo no marca media transcripcion (ruido bajo)', cot);
  chk(cot.tot > 100, 'y si esta cotejando de verdad', cot);

  console.log('\n5. SYNC, ERROR E INFORME');
  await page.evaluate(() => { document.getElementById('video').currentTime = 10; });
  await page.waitForTimeout(700);
  await page.click('#bError');
  await page.waitForSelector('#modal #mDesc');
  await page.selectOption('#mTipo', 'sin_resalte');
  await page.fill('#mDesc', 'Aqui el resalte coge tres palabras; tiene que ser una.');
  await page.click('#mOk');
  await page.waitForTimeout(400);

  const dl = page.waitForEvent('download');
  await page.click('#bInforme');
  const d = await dl;
  const ruta = path.join(OUT, d.suggestedFilename());
  await d.saveAs(ruta);
  const html = fs.readFileSync(ruta, 'utf8');
  chk(/informe_piti/i.test(d.suggestedFilename()), 'el nombre del informe sale del doc', d.suggestedFilename());
  chk(html.indexOf('data:image/jpeg;base64') >= 0, 'captura incrustada', null);

  const p2 = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errInf = [];
  p2.on('pageerror', e => errInf.push(e.message));
  await p2.goto('file://' + ruta);
  await p2.waitForTimeout(400);
  chk(await p2.locator('section.clip').count() === 15, '15 secciones en el informe', null);
  chk(await p2.locator('article.err').count() === 1, 'con su observacion', null);
  chk(errInf.length === 0, 'informe sin errores de JS', errInf);

  console.log('\n6. CONSOLA');
  chk(errsJS.length === 0, 'sin errores de JS en toda la sesion', errsJS.slice(0, 4));

  await page.click('.tab[data-v="subs"]');
  await page.screenshot({ path: path.join(OUT, 'piti-subs.png') });
  await page.click('.tab[data-v="clips"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'piti-clips.png') });

  await browser.close();
  console.log('\n==============================');
  console.log('  ' + ok + ' OK - ' + fallos + ' fallo(s)');
  console.log('==============================\n');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('EXPLOTO:', e); process.exit(2); });
