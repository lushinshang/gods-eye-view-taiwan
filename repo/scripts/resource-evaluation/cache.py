"""Separate persistent Chromium profile: physical HTTP cache bytes and warm reuse."""
import datetime,json,pathlib,subprocess,tempfile,time
from playwright.sync_api import sync_playwright
from host import OUT

if __name__=='__main__':
 with tempfile.TemporaryDirectory(prefix='gev-resource-profile-') as profile:
  result={'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'runs':[]}
  with sync_playwright() as p:
   context=p.chromium.launch_persistent_context(profile,channel='chrome',headless=False,
       viewport={'width':1920,'height':1080},device_scale_factor=1)
   page=context.pages[0];cdp=context.new_cdp_session(page);cdp.send('Network.enable')
   finished=[];responses=[]
   cdp.on('Network.loadingFinished',lambda e:finished.append(e['encodedDataLength']))
   cdp.on('Network.responseReceived',lambda e:responses.append({'url':e['response']['url'].split('?')[0],
      'status':e['response']['status'],'diskCache':e['response'].get('fromDiskCache',False)}))
   for label in ['cold','warm']:
    finished.clear();responses.clear();start=time.monotonic()
    page.goto('http://localhost:4173/?welcome=0',wait_until='domcontentloaded',timeout=90000)
    page.wait_for_timeout(15000)
    caches=[]
    for name in ['Default/Cache','Default/Code Cache','Default/GPUCache']:
     directory=pathlib.Path(profile)/name
     files=[x for x in directory.rglob('*') if x.is_file()] if directory.exists() else []
     caches.append({'directory':name,'files':len(files),'logical_bytes':sum(x.stat().st_size for x in files),
                    'allocated_bytes':sum(x.stat().st_blocks*512 for x in files)})
    result['runs'].append({'label':label,'wallSeconds':time.monotonic()-start,'cdpTransferredBytes':sum(finished),
       'completedRequests':len(finished),'diskCachedResponses':sum(x['diskCache'] for x in responses),
       'cacheDirectories':caches,'responses':responses.copy()})
   context.close()
  (OUT/'cache.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
  print(json.dumps([{k:v for k,v in x.items() if k!='responses'} for x in result['runs']],ensure_ascii=False,indent=2))
