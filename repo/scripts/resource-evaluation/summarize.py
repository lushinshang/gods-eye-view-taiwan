"""Summarize recorded samples; no inferred numbers are inserted into raw observations."""
import datetime,json,re,statistics
from host import OUT,api,run,telemetry

def distribution(values):
    return {'n':len(values),'min':min(values),'mean':statistics.mean(values),'max':max(values)} if values else None

def docker_summary(samples):
    rows=[];anon=[];rss=[];gpu=[];cpu=[]
    for s in samples:
        if 'docker' in s:
            try:rows.append(json.loads(s['docker']['output'].strip().splitlines()[0]))
            except Exception:pass
        if 'cgroup' in s:
            m=re.search(r'^anon (\d+)',s['cgroup']['output'],re.M)
            if m:anon.append(int(m[1])/1048576)
        if 'container_rss' in s:
            lines=s['container_rss']['output'].splitlines()[1:]
            rss.append(sum(int(x.split()[1]) for x in lines if len(x.split())>=3)/1024)
        if 'gpu' in s:
            m=re.search(r'"Device Utilization %"=(\d+)',s['gpu']['output'])
            if m:gpu.append(int(m[1]))
        if 'processes' in s:
            values=[]
            for line in s['processes']['output'].splitlines():
                fields=line.split()
                if len(fields)>4 and 'ollama' in line.lower():
                    try:values.append(float(fields[2]))
                    except ValueError:pass
            if values:cpu.append(sum(values))
    mem=[]
    for r in rows:
        m=re.match(r'([\d.]+)([KMG]i?B)',r['MemUsage'])
        if m:
            value=float(m[1]);unit=m[2]
            mem.append(value*{'MiB':1,'GiB':1024,'MB':1e6/1048576,'GB':1e9/1048576}.get(unit,1))
    return {'container_cpu_percent':distribution([float(r['CPUPerc'].rstrip('%')) for r in rows]),
            'container_memory_mib':distribution(mem),'cgroup_anon_mib':distribution(anon),
            'process_rss_mib':distribution(rss),'host_gpu_percent':distribution(gpu),
            'ollama_process_cpu_percent':distribution(cpu),
            'first':rows[0] if rows else None,'last':rows[-1] if rows else None}

if __name__=='__main__':
    host=json.loads((OUT/'host.json').read_text());browser=json.loads((OUT/'browser.json').read_text())
    result={'end_time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scenarios':[]}
    for s in browser['scenarios']:
        result['scenarios'].append({'label':s['label'],'vessels':s['vessels'],
          'heap_mib':s['heap']['used']/1048576,'cdp_heap_mib':s['cdpHeap']['usedSize']/1048576,
          'backing_mib':s['cdpHeap']['backingStorageSize']/1048576,'dom_nodes':s['cdpDOM']['nodes'],
          'dom_elements':s['domElements'],'fps':s['actualRenderFPS'],
          'frame_p95_ms':s['frameIntervalP95'],'draws_per_frame':s['drawsPerFrame'],
          'resources':docker_summary(s['hostSamples'])})
    if (OUT/'ollama.json').exists():
        ollama=json.loads((OUT/'ollama.json').read_text());result['ollama']=[]
        for r in ollama['requests']:
            models=[m for s in r['samples']+[r['after']] for m in s.get('ollama',{}).get('models',[])]
            result['ollama'].append({k:v for k,v in r.items() if k not in ['samples','after']})
            result['ollama'][-1].update({'resources':docker_summary(r['samples']),
                'loaded_models':models[-1:]})
    result['final']=telemetry(); result['track_end']=api('http://localhost:4173/api/taiwan-vessel-tracks?mode=summary')
    result['disk_end']=run('du -sk .gev-cache .gev-cache/taiwan-tracks; du -ak .gev-cache | sort -n')
    (OUT/'summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps({k:v for k,v in result.items() if k not in ['final']},ensure_ascii=False,indent=2))
