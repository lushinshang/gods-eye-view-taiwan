import {readFile,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const {Window}=await import(pathToFileURL(resolve('1151104_gods-eye-view/repo/node_modules/happy-dom/lib/index.js')).href);
const html=await readFile('1151104_gods-eye-view/security-assessment-report/index.html','utf8');
let w=new Window({url:'https://report.invalid/',settings:{enableJavaScriptEvaluation:false,disableJavaScriptFileLoading:true,disableCSSFileLoading:true}});w.document.write(html);let doc=w.document;
assert.equal(doc.querySelectorAll('#finding-list .filterable').length,4);assert.equal(doc.querySelectorAll('#scenario-list .filterable').length,15);assert(Array.from(doc.querySelectorAll('details[data-fold]')).every(d=>d.open));
assert(doc.getElementById('report-qa').textContent.includes('NOT_VERIFIED_BROWSER_UNAVAILABLE'));
const skip=doc.querySelector('.skip');assert.equal(skip.getAttribute('href'),'#main');doc.getElementById('main').focus();assert.equal(doc.activeElement.id,'main');
for(const e of doc.querySelectorAll('svg a'))assert.equal(e.getAttribute('tabindex'),'0');
for(const f of doc.querySelectorAll('form')){assert(f.getAttribute('aria-label'));assert(f.querySelector('label input'));assert(f.querySelector('label select'));}
await w.happyDOM.close();
w=new Window({url:'https://report.invalid/',settings:{enableJavaScriptEvaluation:false,disableJavaScriptFileLoading:true,disableCSSFileLoading:true}});w.matchMedia=()=>({matches:true,addEventListener(){}});w.document.write(html);doc=w.document;w.eval(Array.from(doc.querySelectorAll('script')).find(s=>!s.type).textContent);
assert(Array.from(doc.querySelectorAll('[data-animation-toggle]')).every(b=>b.disabled && b.getAttribute('aria-pressed')==='false'));assert(Array.from(doc.querySelectorAll('.diagram')).every(g=>g.dataset.playing==='false'));
const result={task:8,synthetic_status:'PASS',scope:'Report interface only; native browser unavailable.','checks':['Core content and evidence exist with JavaScript disabled','Skip link target supports programmatic focus','SVG links declare keyboard focus and evidence targets','Filter controls have labels','Reduced-motion enabled at startup prevents animation','Delivery QA limitations visible in report'],'native_browser_status':'NOT_VERIFIED_BROWSER_UNAVAILABLE','native_keyboard_navigation':'NOT_VERIFIED','layout_at_390px_and_desktop':'NOT_VERIFIED','native_browser_print_and_csp':'NOT_VERIFIED'};
await writeFile('1151104_gods-eye-view/security-assessment-report/qa/task-8-synthetic-verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));await w.happyDOM.close();
