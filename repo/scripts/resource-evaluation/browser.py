"""Playwright/CDP + actual WebGL draw calls; headed Chrome, no SwiftShader flags."""
import datetime, json, time, threading, sys
from playwright.sync_api import sync_playwright
from host import OUT, telemetry
from ollama_bench import benchmark

INIT = r'''(() => {
  window.__draws=0;
  for(const proto of [window.WebGLRenderingContext?.prototype,window.WebGL2RenderingContext?.prototype]){
    if(!proto)continue;
    for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced','drawRangeElements']){
      if(!Object.prototype.hasOwnProperty.call(proto,name))continue;
      const original=proto[name]; if(typeof original!=='function')continue;
      proto[name]=function(...args){window.__draws++; return original.apply(this,args)};
    }
  }
  performance.setResourceTimingBufferSize(30000);
})()'''

MEASURE = r'''async ({seconds,moving})=>{
 const m=window.__manager, viewer=m.viewer, scene=viewer.scene;
 const before=performance.now(), drawsBefore=window.__draws;
 const intervals=[],perFrameDraws=[];let frames=0,rafs=0,last=null,lastDraw=window.__draws,active=true;
 const remove=scene.postRender.addEventListener(()=>{
   const t=performance.now();if(last!==null)intervals.push(t-last);last=t;frames++;
   perFrameDraws.push(window.__draws-lastDraw);lastDraw=window.__draws;
 });
 function animate(){if(!active)return;rafs++;if(moving){viewer.camera.rotateRight(0.00012);scene.requestRender();}requestAnimationFrame(animate)}
 requestAnimationFrame(animate);await new Promise(r=>setTimeout(r,seconds*1000)); active=false;remove();
 const elapsed=(performance.now()-before)/1000;
 const sorted=intervals.slice().sort((a,b)=>a-b), ds=perFrameDraws.slice().sort((a,b)=>a-b);
 const percentile=(a,p)=>a.length?a[Math.min(a.length-1,Math.floor(a.length*p))]:null;
 const resources=performance.getEntriesByType('resource');
 const nav=performance.getEntriesByType('navigation');
 const all=resources.concat(nav);
 const sum=(key)=>all.reduce((s,x)=>s+(x[key]||0),0);
 const gl=scene.context._gl,debug=gl.getExtension('WEBGL_debug_renderer_info');
 return {elapsed,rafFPS:rafs/elapsed,actualRenderFPS:frames/elapsed,renderedFrames:frames,
   frameIntervalP50:percentile(sorted,.5),frameIntervalP95:percentile(sorted,.95),
   drawsTotal:window.__draws-drawsBefore,drawsPerFrame:frames?(window.__draws-drawsBefore)/frames:null,
   drawsPerFrameP95:percentile(ds,.95),heap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize,limit:performance.memory.jsHeapSizeLimit}:null,
   domElements:document.querySelectorAll('*').length,vessels:m.vessels.length,billboards:m.collection.length,
   shownBillboards:[...m.billboardMap.values()].filter(b=>b.show).length,
   renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
   camera:{height:viewer.camera.positionCartographic.height,longitude:viewer.camera.positionCartographic.longitude*180/Math.PI,latitude:viewer.camera.positionCartographic.latitude*180/Math.PI,sceneMode:scene.mode,globeShow:scene.globe.show},
   resolutionScale:viewer.resolutionScale,canvas:{width:scene.canvas.width,height:scene.canvas.height},
   tilesLoaded:scene.globe.tilesLoaded,requestRenderMode:scene.requestRenderMode,
   resources:{count:all.length,transferSize:sum('transferSize'),encodedBodySize:sum('encodedBodySize'),decodedBodySize:sum('decodedBodySize'),zeroTransfer:all.filter(x=>!x.transferSize).length},
   resourceList:all.map(x=>({url:x.name.split('?')[0],transfer:x.transferSize,encoded:x.encodedBodySize,decoded:x.decodedBodySize}))};
}'''

def main():
    resume='--resume' in sys.argv
    result=json.loads((OUT/'browser.json').read_text()) if resume else {'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scenarios':[], 'errors':[]}
    if resume:result['resumed_at']=datetime.datetime.now(datetime.timezone.utc).isoformat()
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',headless=False,args=['--enable-precise-memory-info','--disable-background-timer-throttling','--disable-renderer-backgrounding'])
        context=browser.new_context(viewport={'width':1920,'height':1080},device_scale_factor=1)
        page=context.new_page(); page.add_init_script(INIT)
        page.on('pageerror',lambda e:result['errors'].append(str(e)))
        cdp=context.new_cdp_session(page); cdp.send('Network.enable');cdp.send('Performance.enable')
        network=[];responses=[]
        cdp.on('Network.loadingFinished',lambda e:network.append({'id':e['requestId'],'bytes':e['encodedDataLength']}))
        cdp.on('Network.responseReceived',lambda e:responses.append({'id':e['requestId'],'status':e['response']['status'],
            'url':e['response']['url'].split('?')[0], 'diskCache':e['response'].get('fromDiskCache',False)}))
        start=time.monotonic();page.goto('http://localhost:4173/?welcome=0',wait_until='domcontentloaded',timeout=90000)
        page.wait_for_function("async()=>{const m=(await import('/src/layers/taiwanVessels/taiwanManager.js')).taiwanVesselsManager;window.__manager=m;return !!m.viewer&&m.vessels.length>0}",timeout=90000)
        page.evaluate("""()=>{const m=window.__manager;clearInterval(m.pollTimer);m.pollTimer=null;}""")
        page.wait_for_timeout(12000)
        snapshot=page.evaluate("()=>{window.__liveRows=JSON.parse(JSON.stringify(window.__manager.vessels));return window.__liveRows.length}")
        print('Preserved real vessel snapshot:',snapshot,flush=True)
        if not resume: result['cold_load']={'wallToSettledSeconds':time.monotonic()-start,'cdpTransferredBytes':sum(x['bytes'] for x in network),'completedRequests':len(network),'diskCachedResponses':sum(x['diskCache'] for x in responses),'responses':responses.copy()}
        result['browser_version']=browser.version
        def save(): (OUT/'browser.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
        def measure(label,moving=False,seconds=15):
            page.bring_to_front()
            page.evaluate("""()=>{const m=window.__manager;m.viewer.camera.cancelFlight();m.viewer.camera.setView({destination:m.viewer.camera.position.constructor.fromDegrees(121,23.6,800000),orientation:{heading:0,pitch:-Math.PI/2,roll:0}});m.viewer.scene.requestRender()}""")
            page.wait_for_timeout(3000)
            samples=[];stop=threading.Event()
            def monitor():
                while not stop.is_set():
                    try:samples.append(telemetry())
                    except Exception as e:samples.append({'error':str(e)})
                    stop.wait(1)
            thread=threading.Thread(target=monitor,daemon=True);thread.start()
            try:
                d=page.evaluate(MEASURE,{'seconds':seconds,'moving':moving})
                d['cdpDOM']=cdp.send('Memory.getDOMCounters')
                d['cdpPerformance']=cdp.send('Performance.getMetrics')
                d['cdpHeap']=cdp.send('Runtime.getHeapUsage')
            finally:stop.set();thread.join(timeout=15)
            d.update({'label':label,'moving':moving,'hostSamples':samples}); result['scenarios'].append(d);save()
            print(json.dumps({k:v for k,v in d.items() if k not in ['resourceList','hostSamples','cdpPerformance']},ensure_ascii=False),flush=True)
        if not resume:
            measure('live_static')
            measure('live_moving',True)
            page.evaluate("()=>{window.__liveRows=JSON.parse(JSON.stringify(window.__manager.vessels));const m=window.__manager;m.vessels=[];m.syncBillboards();m.recomputeStats();m.notify()}")
            cdp.send('HeapProfiler.collectGarbage');page.wait_for_timeout(3000)
            measure('zero_ships_warm_static')
            measure('zero_ships_warm_moving',True)
        page.evaluate("()=>{const m=window.__manager;if(window.__liveRows.length<9000)throw Error('Insufficient actual vessels for 9000 test');m.vessels=window.__liveRows.slice(0,9000);m.syncBillboards();m.recomputeStats();m.notify()}")
        cdp.send('HeapProfiler.collectGarbage');page.wait_for_timeout(3000)
        measure('9000_static')
        measure('9000_moving',True)
        page.screenshot(path=str(OUT/'taiwan-9000.png'))
        page.evaluate("()=>window.__manager.setTrafficEnabled(true)")
        page.wait_for_timeout(15000)
        measure('9000_traffic_static')
        result['traffic']=page.evaluate("()=>({events:window.__manager.trafficEvents.length,speeds:window.__manager.trafficSpeeds.length,error:window.__manager.trafficError})")
        # Keep the same visible 3D page open during inference to measure shared RAM pressure.
        result['inference_context']='9000 ship scene + traffic open; static page; no ongoing Playwright frame probe'
        save(); benchmark()
        measure('9000_after_ai_static')
        # Reload the same context: disk/memory cache reuse, without clearing or disabling cache.
        network.clear();responses.clear();page.reload(wait_until='domcontentloaded',timeout=90000)
        page.wait_for_timeout(15000)
        result['warm_reload']={'cdpTransferredBytes':sum(x['bytes'] for x in network),'completedRequests':len(network),'diskCachedResponses':sum(x['diskCache'] for x in responses),'responses':responses}
        save();browser.close()

if __name__=='__main__':main()
