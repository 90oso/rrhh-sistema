const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1400,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('http://127.0.0.1:8765/docs/');
    await page.locator('[data-view="talento"]').click();
    await page.locator('#candidate').fill('Laura Ficticia');
    await page.locator('#add-candidate').click();
    assert.match(await page.locator('#pipeline').innerText(),/Laura Ficticia/);
    await page.locator('[data-stage]').last().selectOption('Contratado');
    await page.locator('[data-view="personal"]').click();
    await page.locator('#people-search').fill('Laura Ficticia');
    assert.match(await page.locator('#people').innerText(),/Laura Ficticia/);
    await page.locator('[data-view="permisos"]').click();
    await page.locator('#employee').selectOption('Laura Ficticia');
    await page.locator('#submit-leave').click();
    await page.locator('[data-approve]').last().click();
    assert.match(await page.locator('#leaves').innerText(),/Aprobado/);
    await fs.promises.mkdir('test-results',{recursive:true});
    await page.screenshot({path:'test-results/rrhh-suite.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('Suite RRHH: demo interactiva OK');
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
