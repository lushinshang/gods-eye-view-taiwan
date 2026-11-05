"""Measure one real upstream response per endpoint; retain sizes, not feed bodies."""
import concurrent.futures, datetime, json, pathlib, subprocess, tempfile
from host import OUT

URLS = {
 'mpb_raw':'https://mpbais.motcmpb.gov.tw/aismpb/tools/geojsonais.ashx',
 'tisv_events':'https://tisvcloud.freeway.gov.tw/history/motc20/LiveEvents.xml',
 'tisv_traffic':'https://tisvcloud.freeway.gov.tw/history/motc20/LiveTraffic.xml',
 'tisv_sections':'https://tisvcloud.freeway.gov.tw/history/motc20/Section.xml',
 'tisv_shapes':'https://tisvcloud.freeway.gov.tw/history/motc20/SectionShape.xml',
 'pbs':'https://od.moi.gov.tw/api/v1/rest/datastore/A01010000C-000674-015',
 'proxy_vessels':'http://localhost:4173/api/taiwan-vessels',
 'proxy_traffic':'http://localhost:4173/api/taiwan-traffic',
}
def measure(item):
 label,url=item
 with tempfile.TemporaryDirectory() as tmp:
  body=pathlib.Path(tmp)/'body'; headers=pathlib.Path(tmp)/'headers'
  cmd=['curl','--http1.1','-sS','--max-time','40','-A','Mozilla/5.0 GodsEyeView','-D',str(headers),'-o',str(body),'-w','%{json}',url]
  if label=='mpb_raw':cmd[1:1]=['-H','Referer: https://mpbais.motcmpb.gov.tw/']
  elif not label.startswith('proxy'):cmd.insert(1,'--compressed')
  r=subprocess.run(cmd,capture_output=True,text=True)
  d={'label':label,'url':url,'exit':r.returncode,'stderr':r.stderr,'decoded_bytes':body.stat().st_size if body.exists() else 0,
     'headers':headers.read_text() if headers.exists() else ''}
  try:
   metrics=json.loads(r.stdout)
   d['metrics']={k:metrics.get(k) for k in ['http_code','size_download','size_header','time_total','speed_download','content_type']}
   if label.startswith('proxy') and body.exists():
    data=json.loads(body.read_bytes());d['payload_summary']={k:v for k,v in data.items() if k in ['total','data_health','summary','error']}
    for k in ['events','speeds','rows']:
     if isinstance(data.get(k),list):d[k+'_count']=len(data[k])
  except Exception as e:d['parse_error']=str(e)
  return d

if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: results=list(pool.map(measure,URLS.items()))
 (OUT/'network.json').write_text(json.dumps({'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'requests':results},ensure_ascii=False,indent=2))
 for r in results: print(json.dumps({k:v for k,v in r.items() if k not in ['headers']},ensure_ascii=False))
