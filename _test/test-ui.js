/* Los tres cambios: tipos nuevos, no saltar de pestaña, y acordeon en Errores */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const RAIZ = path.resolve(__dirname, '..');
const FIX = '/tmp/qc/fixtures';
const OUT = '/tmp/qc/salida5';
fs.mkdirSync(OUT, { recursive: true });

let fallos = 0, ok = 0;
function chk(c, m, x) {
  if (c) { ok++; console.log('  ✓ ' + m); }
  else { fallos++; console.log('  ✗ ' + m + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); }
}
const pestana = p => p.evaluate(() => {
  const t = document.querySelector('.tab.act');
  return t ? t.dataset.v : null;
});

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const errsJS = [];
  page.on('pageerror', e => errsJS.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errsJS.push(m.text()); });
  await page.goto('file://' + path.join(RAIZ, 'index.html'));

  await page.setInputFiles('#inArchivos', [
    path.join(FIX, 'reel01.webm'), path.join(FIX, 'reel02.webm'),
    path.join(FIX, 'reel03.webm'), path.join(FIX, 'proyecto.srt')
  ]);
  await page.waitForFunction(() => window.QC && QC.S.clips.length === 3, null, { timeout: 30000 });
  await page.waitForTimeout(800);

  console.log('\n1. TIPOS DE ERROR');
  const tipos = await page.evaluate(() => QC.S && Array.from(document.querySelectorAll('#mTipo option')).map(o => o.value));
  const listaJS = await page.evaluate(() => {
    // TIPOS no esta exportado: lo leemos del desplegable del modal abriendo uno
    return null;
  });
  await page.evaluate(() => { document.getElementById('video').currentTime = 4; });
  await page.waitForTimeout(700);
  await page.click('#bError');
  await page.waitForSelector('#modal #mTipo');
  const ops = await page.evaluate(() => Array.from(document.querySelectorAll('#mTipo option')).map(o => ({ v: o.value, t: o.textContent })));
  chk(ops.some(o => o.v === 'ortografia' && /Ortograf/.test(o.t)), 'existe el tipo «Ortografía»', ops.map(o => o.v));
  const ft = ops.find(o => o.v === 'texto_falta');
  chk(ft && ft.t === 'Falta texto', 'el tipo de texto que falta se llama «Falta texto»', ft);
  chk(!ops.some(o => /Palabra faltante/.test(o.t)), 'ya no queda el nombre viejo', ops.map(o => o.t));
  chk(ops.length === 12, '12 tipos en total', ops.length);

  await page.selectOption('#mTipo', 'ortografia');
  await page.fill('#mDesc', 'Falta la tilde en «disciplina».');
  await page.click('#mOk');
  await page.waitForTimeout(400);
  const guardado = await page.evaluate(() => QC.todosLosErrores()[0].tipo);
  chk(guardado === 'ortografia', 'se guarda con el tipo ortografía', guardado);

  console.log('\n2. NO CAMBIAR DE PESTAÑA AL AÑADIR');
  for (const tab of ['subs', 'guion', 'clips', 'ajustes']) {
    await page.click('.tab[data-v="' + tab + '"]');
    await page.waitForTimeout(250);
    await page.evaluate(() => { document.getElementById('video').currentTime += 0.7; });
    await page.waitForTimeout(500);
    await page.click('#bError');
    await page.waitForSelector('#modal #mDesc');
    await page.fill('#mDesc', 'Prueba desde la pestaña ' + tab);
    await page.click('#mOk');
    await page.waitForTimeout(400);
    const donde = await pestana(page);
    chk(donde === tab, 'sigue en «' + tab + '» despues de añadir el error', donde);
  }
  // tambien con el atajo E
  await page.click('.tab[data-v="subs"]');
  await page.waitForTimeout(250);
  await page.evaluate(() => { document.getElementById('video').currentTime = 7.5; });
  await page.waitForTimeout(500);
  await page.keyboard.press('e');
  await page.waitForSelector('#modal #mDesc');
  await page.fill('#mDesc', 'Con el atajo E.');
  await page.click('#mOk');
  await page.waitForTimeout(400);
  chk(await pestana(page) === 'subs', 'con el atajo <E> tampoco se mueve', await pestana(page));

  // y el scroll del panel se queda donde estaba
  await page.evaluate(() => { document.getElementById('panel').scrollTop = 220; });
  await page.waitForTimeout(200);
  const scAntes = await page.evaluate(() => document.getElementById('panel').scrollTop);
  await page.evaluate(() => { document.getElementById('video').currentTime = 9.5; });
  await page.waitForTimeout(500);
  await page.click('#bError');
  await page.waitForSelector('#modal #mDesc');
  await page.fill('#mDesc', 'Sin perder el scroll.');
  await page.click('#mOk');
  await page.waitForTimeout(500);
  const scDespues = await page.evaluate(() => document.getElementById('panel').scrollTop);
  chk(Math.abs(scDespues - scAntes) < 90, 'no se pierde el scroll del panel', { scAntes: scAntes, scDespues: scDespues });

  console.log('\n3. ERRORES REPARTIDOS EN VARIOS CLIPS');
  await page.evaluate(() => QC.irAClip(1, 4));
  await page.waitForTimeout(1000);
  for (const d of ['Encuadre del clip 2.', 'Color del clip 2.']) {
    await page.evaluate(() => { document.getElementById('video').currentTime += 1.2; });
    await page.waitForTimeout(450);
    await page.click('#bError');
    await page.waitForSelector('#modal #mDesc');
    await page.selectOption('#mSev', d.indexOf('Color') >= 0 ? 'medio' : 'critico');
    await page.fill('#mDesc', d);
    await page.click('#mOk');
    await page.waitForTimeout(350);
  }
  const reparto = await page.evaluate(() => QC.S.clips.map(c => c.errores.length));
  chk(reparto[0] >= 5 && reparto[1] === 2 && reparto[2] === 0, 'errores en 2 clips y uno limpio', reparto);

  console.log('\n4. ACORDEON DE LA PESTAÑA ERRORES');
  await page.click('.tab[data-v="errores"]');
  await page.waitForTimeout(500);
  const grupos = await page.locator('#v-errores .grupo:not(.limpio)').count();
  chk(grupos === 2, 'un desplegable por clip con errores', grupos);
  chk(await page.locator('#v-errores .grupo.limpio').count() === 1, 'los clips sin errores en una sola linea', null);
  const limpioTxt = await page.textContent('#v-errores .grupo.limpio');
  chk(/1 clip\(s\) sin observaciones/.test(limpioTxt), 'y dice cuantos son', limpioTxt.replace(/\s+/g, ' '));

  const abiertos = await page.evaluate(() => Array.from(document.querySelectorAll('#v-errores .grupo.abierto')).map(g => g.dataset.g));
  chk(abiertos.length === 1 && abiertos[0] === '1', 'arranca abierto solo el clip en el que estas', abiertos);

  // cerrar el actual
  await page.click('#v-errores .grupo[data-g="1"] .grupoCab');
  await page.waitForTimeout(300);
  chk(await page.locator('#v-errores .grupo.abierto').count() === 0, 'se cierra al pulsar la cabecera', null);
  chk(await page.locator('#v-errores .err').count() === 0, 'y no muestra ninguna tarjeta', null);

  // abrir el otro
  await page.click('#v-errores .grupo[data-g="0"] .grupoCab');
  await page.waitForTimeout(300);
  const dentro = await page.locator('#v-errores .grupo[data-g="0"] .err').count();
  chk(dentro >= 5, 'se abre el clip 1 con sus tarjetas dentro', dentro);
  chk(await page.locator('#v-errores .grupo[data-g="1"] .err').count() === 0, 'y el otro sigue cerrado', null);

  // badges por severidad
  const cab = await page.textContent('#v-errores .grupo[data-g="1"] .grupoCab');
  chk(/crítico/.test(cab) && /medio/.test(cab), 'la cabecera resume criticos y medios', cab.replace(/\s+/g, ' '));

  // abrir todo / cerrar todo
  await page.click('#bAbrirTodo');
  await page.waitForTimeout(300);
  chk(await page.locator('#v-errores .grupo.abierto').count() === 2, '«Abrir todo» abre los dos', null);
  await page.click('#bCerrarTodo');
  await page.waitForTimeout(300);
  chk(await page.locator('#v-errores .grupo.abierto').count() === 0, '«Cerrar todo» los cierra', null);

  // el estado aguanta un repintado
  await page.click('#v-errores .grupo[data-g="0"] .grupoCab');
  await page.waitForTimeout(250);
  await page.evaluate(() => QC.irAClip(0, 2));
  await page.waitForTimeout(900);
  const trasRepintado = await page.evaluate(() => Array.from(document.querySelectorAll('#v-errores .grupo.abierto')).map(g => g.dataset.g));
  chk(JSON.stringify(trasRepintado) === '["0"]', 'lo que abriste sigue abierto tras cambiar de clip', trasRepintado);
  // y al cambiar a un clip que habias cerrado, sigue cerrado
  await page.evaluate(() => QC.irAClip(1, 2));
  await page.waitForTimeout(900);
  const alVolver = await page.evaluate(() => Array.from(document.querySelectorAll('#v-errores .grupo.abierto')).map(g => g.dataset.g));
  chk(alVolver.indexOf('1') < 0, 'un clip que cerraste a mano no se reabre solo', alVolver);
  await page.evaluate(() => QC.irAClip(0, 2));
  await page.waitForTimeout(800);

  // al añadir un error se abre el clip de ese error, sin sacarte de la pestaña
  await page.evaluate(() => { document.getElementById('video').currentTime = 3; });
  await page.waitForTimeout(500);
  await page.click('#bError');
  await page.waitForSelector('#modal #mDesc');
  await page.fill('#mDesc', 'Otro mas en el clip 1.');
  await page.click('#mOk');
  await page.waitForTimeout(500);
  chk(await pestana(page) === 'errores', 'sigue en la pestaña Errores', await pestana(page));
  chk(await page.locator('#v-errores .grupo[data-g="0"].abierto').count() === 1, 'y el clip del error queda abierto', null);

  // ir al punto y editar siguen funcionando
  await page.click('#v-errores .grupo[data-g="0"] [data-ir]');
  await page.waitForTimeout(700);
  const t = await page.evaluate(() => ({ i: QC.S.actual, t: +document.getElementById('video').currentTime.toFixed(1) }));
  chk(t.i === 0, '«Ir al punto» salta al clip correcto', t);
  await page.click('#v-errores .grupo[data-g="0"] [data-ed]');
  await page.waitForTimeout(600);
  chk(await page.locator('#modal #mDesc').count() === 1, '«Editar» abre la ficha', null);
  await page.click('#mCancel');
  await page.waitForTimeout(200);

  console.log('\n5. EL INFORME RECOGE LOS TIPOS NUEVOS');
  const dl = page.waitForEvent('download');
  await page.click('#bInforme');
  const d = await dl;
  const ruta = path.join(OUT, d.suggestedFilename());
  await d.saveAs(ruta);
  const html = fs.readFileSync(ruta, 'utf8');
  chk(html.indexOf('Ortografía') >= 0, 'el informe nombra «Ortografía»', null);
  chk(html.indexOf('Palabra faltante') < 0, 'y no queda el nombre viejo', null);

  const p2 = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errInf = [];
  p2.on('pageerror', e => errInf.push(e.message));
  await p2.goto('file://' + ruta);
  await p2.waitForTimeout(400);
  chk(await p2.locator('article.err').count() >= 8, 'el informe lista todos los errores', await p2.locator('article.err').count());
  chk(errInf.length === 0, 'informe sin errores de JS', errInf);

  console.log('\n6. CONSOLA');
  chk(errsJS.length === 0, 'sin errores de JS', errsJS.slice(0, 4));

  await page.click('.tab[data-v="errores"]');
  await page.click('#bAbrirTodo');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'acordeon.png') });

  await browser.close();
  console.log('\n==============================');
  console.log('  ' + ok + ' OK - ' + fallos + ' fallo(s)');
  console.log('==============================\n');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('EXPLOTO:', e); process.exit(2); });
