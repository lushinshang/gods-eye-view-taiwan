import { createRequire } from 'node:module';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const puppeteer = require(resolve('1151104_gods-eye-view/repo/node_modules/puppeteer'));
const profile = await mkdtemp(join(tmpdir(), 'a24-report-qa-'));
let browser;
const result = { scope: 'Report interface smoke only; not product security testing.', nativeSandboxDisabled: false };
try {
 browser = await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, pipe:true, userDataDir:profile, timeout:15000, args:['--disable-background-networking','--disable-sync','--no-first-run','--disable-extensions']});
 const page = await browser.newPage();
 await page.setRequestInterception(true);
 const refused = [];
 page.on('request',request => {if (request.url().startsWith('file:')) request.continue(); else { refused.push(request.url()); request.abort(); }});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:1440,height:1000});
 await page.goto(pathToFileURL(resolve('1151104_gods-eye-view/security-assessment-report/index.html')).href,{waitUntil:'load',timeout:10000});
 result.initial = await page.evaluate(()=>({findings:document.querySelectorAll('#finding-list .filterable').length,scenarios:document.querySelectorAll('#scenario-list .filterable').length,enhanced:document.documentElement.classList.contains('js-enabled'),overflow:document.documentElement.scrollWidth>innerWidth}));
 await page.select('[data-filter-for="finding-list"] select','CONFIRMED');
 result.filteredFindings = await page.$$eval('#finding-list .filterable',els=>els.filter(x=>!x.hidden).map(x=>x.id));
 await page.type('[data-filter-for="scenario-list"] input','GEV-12');
 result.filteredScenarios = await page.$$eval('#scenario-list .filterable',els=>els.filter(x=>!x.hidden).map(x=>x.id));
 await page.click('[data-details-action="open"]');
 result.allEvidenceOpen = await page.$$eval('details[data-fold]',els=>els.every(x=>x.open));
 await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
 result.printExpanded = await page.$$eval('.filterable',els=>els.every(x=>!x.hidden));
 await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
 await page.setViewport({width:390,height:844});
 result.mobileOverflow = await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 await page.screenshot({path:'1151104_gods-eye-view/security-assessment-report/qa/task4-mobile-smoke.png',fullPage:false});
 result.pageErrors=errors;result.refusedResourceRequests=refused.length;
 result.status = result.initial.enhanced && result.initial.findings===4 && result.initial.scenarios===15 && !result.initial.overflow && result.filteredFindings.join()==='GEV-F-001' && result.filteredScenarios.join()==='GEV-12' && result.allEvidenceOpen && result.printExpanded && !result.mobileOverflow && errors.length===0 ? 'PASS':'FAIL';
} catch(error) { result.status='BLOCKED';result.reason=error.message; }
finally { if(browser) await browser.close(); await rm(profile,{recursive:true,force:true}); }
await writeFile('1151104_gods-eye-view/security-assessment-report/qa/task-4-browser-smoke.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
