/* 1) Cruce automatico cuando los .mp4 NO se llaman como el C) Titulo del doc
   2) Que no se pierda el avance al recargar la pagina */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const RAIZ = path.resolve(__dirname, '..');
const FIX4 = '/tmp/qc/fix4';
const OUT = '/tmp/qc/salida4';
fs.mkdirSync(OUT, { recursive: true });
const esperado = JSON.parse(fs.readFileSync(path.join(FIX4, 'esperado.json'), 'utf8'));

let fallos = 0, ok = 0;
function chk(c, m, x) {
  if (c) { ok++; console.log('  ✓ ' + m); }
  else { fallos++; console.log('  ✗ ' + m + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const page = await ctx.newPage();
  const errsJS = [];
  page.on('pageerror', e => errsJS.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errsJS.push(m.text()); });
  const URLAPP = 'file://' + path.join(RAIZ, 'index.html');
  await page.goto(URLAPP);

  const videos = esperado.map(m => path.join(FIX4, m.renombrado));

  console.log('\n1. CRUCE CON LOS VIDEOS RENOMBRADOS (PITI_reel_01_MAO.webm ...)');
  await page.setInputFiles('#inArchivos', videos.concat([
    path.join(FIX4, 'proyecto.srt'),
    path.join(FIX4, 'ESENCIA_Piti_Pinsach_editor_aprobados.docx')
  ]));
  await page.waitForFunction(() => window.QC && QC.S.clips.length === 15, null, { timeout: 60000 });
  await page.waitForTimeout(3000);

  const cruce = await page.evaluate(() => QC.S.clips.map(c => ({
    nombre: c.nombre, docNum: c.doc ? c.doc.num : null,
    como: c.comoCruzo, nsubs: c.subs.length, coinc: +(c.coinc || 0).toFixed(2)
  })));
  const esp = {};
  esperado.forEach(m => { esp[m.renombrado] = m; });

  chk(cruce.every(c => c.docNum), 'los 15 cruzaron aunque el nombre no diga nada', cruce.filter(c => !c.docNum).map(c => c.nombre));
  chk(cruce.every(c => c.como !== 'nombre'), 'ninguno cruzo por nombre (era imposible)', cruce.map(c => c.como));
  const porDur = cruce.filter(c => c.como === 'duración').length;
  chk(porDur >= 12, 'la mayoria cruzo por duracion del tramo', { porDur, todos: cruce.map(c => c.como) });

  const aciertos = cruce.filter(c => esp[c.nombre] && c.docNum === esp[c.nombre].num).length;
  chk(aciertos === 15, 'y cada video cayo en SU clip del doc (15/15)',
    cruce.map(c => c.nombre.slice(5, 12) + ':' + c.docNum + '/' + (esp[c.nombre] ? esp[c.nombre].num : '?')));
  chk(cruce.every(c => c.nsubs > 0), 'todos con sus subtitulos', cruce.map(c => c.nsubs));

  console.log('\n2. REASIGNAR A MANO');
  await page.click('.tab[data-v="ajustes"]');
  await page.waitForTimeout(400);
  const nSel = await page.locator('.selDoc').count();
  chk(nSel === 15, 'hay un desplegable por clip para corregirlo a mano', nSel);
  const antes = await page.evaluate(() => QC.S.clips[0].doc.num);
  const otro = await page.evaluate(() => {
    const usados = QC.S.clips.map(c => c.doc && c.doc.num);
    const k = QC.S.doc.findIndex(d => usados.indexOf(d.num) < 0);
    return { k: k, num: QC.S.doc[k].num };
  });
  await page.selectOption('.selDoc[data-i="0"]', String(otro.k));
  await page.waitForTimeout(600);
  const despues = await page.evaluate(() => ({ num: QC.S.clips[0].doc.num, como: QC.S.clips[0].comoCruzo, manual: QC.S.clips[0].docManual }));
  chk(despues.num === otro.num && despues.manual, 'el cambio a mano manda', { antes: antes, despues: despues });
  await page.click('#bAutoCruce');
  await page.waitForTimeout(700);
  const vuelto = await page.evaluate(() => QC.S.clips[0].doc.num);
  chk(vuelto === antes, '«Volver a cruzar solo» deshace el cambio', { vuelto: vuelto, antes: antes });

  console.log('\n3. MARCAR TRABAJO Y RECARGAR LA PAGINA');
  await page.evaluate(() => QC.irAClip(2, 8));
  await page.waitForTimeout(1000);
  await page.click('#bError');
  await page.waitForSelector('#modal #mDesc');
  await page.fill('#mDesc', 'El plano 2 entra descuadrado.');
  await page.click('#mOk');
  await page.waitForTimeout(300);
  await page.click('#bSegOk');
  await page.click('#bSegOk');
  await page.fill('#fProyecto', 'Piti Pinsach');
  await page.fill('#fRevisor', 'Juan Pablo');
  await page.waitForTimeout(2500);   // que le de tiempo al autoguardado

  const guardadoTxt = await page.textContent('#guardado');
  chk(/guardado \d\d:\d\d/.test(guardadoTxt), 'la cabecera confirma el autoguardado', guardadoTxt);
  const enBD = await page.evaluate(async () => {
    const d = await QC.BD.get();
    return d ? { clips: d.clips.length, errs: d.clips.reduce((a, c) => a + c.errores.length, 0), proy: d.proyecto } : null;
  });
  chk(enBD && enBD.clips === 15 && enBD.errs === 1, 'la sesion esta en IndexedDB', enBD);

  // RECARGA
  await page.reload();
  await page.waitForTimeout(1500);
  const barra = await page.locator('#rescate.act').count();
  chk(barra === 1, 'al volver a abrir ofrece recuperar la revision', barra);
  const txt = await page.textContent('#rescateTxt');
  chk(/Piti Pinsach/.test(txt) && /1 error/.test(txt), 'y dice de que revision se trata', txt.replace(/\s+/g, ' '));

  await page.click('#bRescatar');
  await page.waitForTimeout(1200);
  const rec = await page.evaluate(() => ({
    clips: QC.S.clips.length, errs: QC.todosLosErrores().length,
    subs: QC.S.clips.filter(c => c.subs.length).length,
    segs: QC.S.clips.reduce((a, c) => a + c.segsOk.length, 0),
    doc: QC.S.doc.length, conDoc: QC.S.clips.filter(c => c.doc).length,
    proy: document.getElementById('fProyecto').value,
    revisor: document.getElementById('fRevisor').value,
    sinVideo: QC.S.clips.filter(c => !c.url).length,
    captura: !!QC.todosLosErrores()[0].captura
  }));
  chk(rec.clips === 15 && rec.errs === 1, 'recupera los 15 clips y el error', rec);
  chk(rec.captura, 'con su captura de pantalla intacta', rec.captura);
  chk(rec.subs === 15 && rec.doc === 30 && rec.conDoc === 15, 'y los subtitulos y el cruce con el doc', rec);
  chk(rec.segs === 2, 'y los segundos que llevabas revisados', rec.segs);
  chk(rec.proy === 'Piti Pinsach' && rec.revisor === 'Juan Pablo', 'y la cabecera', rec);
  chk(rec.sinVideo === 15, 'los videos hay que volver a arrastrarlos (el navegador no los guarda)', rec.sinVideo);

  console.log('\n4. REENGANCHAR LOS VIDEOS');
  const aviso = await page.textContent('#sinVideo');
  chk(/Falta el vídeo|Arrástralo/.test(aviso), 'te dice exactamente que falta', aviso.replace(/\s+/g, ' ').slice(0, 80));
  await page.setInputFiles('#inArchivos', videos);
  await page.waitForFunction(() => QC.S.clips.filter(c => !c.url).length === 0, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  const tras = await page.evaluate(() => ({
    clips: QC.S.clips.length, errs: QC.todosLosErrores().length,
    subs: QC.S.clips.filter(c => c.subs.length).length,
    segs: QC.S.clips.reduce((a, c) => a + c.segsOk.length, 0),
    conVideo: QC.S.clips.filter(c => c.url).length,
    conDoc: QC.S.clips.filter(c => c.doc).length
  }));
  chk(tras.clips === 15 && tras.conVideo === 15, 'los 15 videos se reenganchan sin duplicar clips', tras);
  chk(tras.errs === 1 && tras.segs === 2 && tras.subs === 15, 'y NO se pierde nada de lo revisado', tras);
  chk(tras.conDoc === 15, 'el cruce con el doc sigue en pie', tras);

  const reproduce = await page.evaluate(() => {
    QC.irAClip(2, 5);
    return new Promise(r => setTimeout(() => {
      const v = document.getElementById('video');
      r({ oculto: v.hidden, t: v.currentTime, ancho: v.videoWidth });
    }, 1500));
  });
  chk(!reproduce.oculto && reproduce.ancho > 0, 'y el video vuelve a verse', reproduce);

  console.log('\n5. DESCARTAR');
  await page.evaluate(async () => { await QC.BD.borrar(); });
  const p2 = await ctx.newPage();
  await p2.goto(URLAPP);
  await p2.waitForTimeout(1200);
  chk(await p2.locator('#rescate.act').count() === 0, 'tras borrar el autoguardado ya no ofrece recuperar', null);

  console.log('\n6. CONSOLA');
  chk(errsJS.length === 0, 'sin errores de JS', errsJS.slice(0, 4));

  await page.click('.tab[data-v="ajustes"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'cruce.png') });

  await browser.close();
  console.log('\n==============================');
  console.log('  ' + ok + ' OK - ' + fallos + ' fallo(s)');
  console.log('==============================\n');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('EXPLOTO:', e); process.exit(2); });
