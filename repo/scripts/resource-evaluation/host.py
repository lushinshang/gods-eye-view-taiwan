"""Read-only host/storage snapshot; does not read .env or cache credentials."""
import datetime, json, pathlib, subprocess, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/resource-evaluation/2026-11-05'
OUT.mkdir(parents=True, exist_ok=True)

def run(cmd, timeout=60):
    p = subprocess.run(cmd, cwd=ROOT, shell=True, text=True, stdout=subprocess.PIPE,
                       stderr=subprocess.STDOUT, timeout=timeout)
    return {'command': cmd, 'exit': p.returncode, 'output': p.stdout}

def api(url, data=None, timeout=40):
    return json.load(urllib.request.urlopen(urllib.request.Request(url,
        data=json.dumps(data).encode() if data is not None else None,
        headers={'Content-Type': 'application/json'}), timeout=timeout))

def telemetry():
    return {'time': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'processes': run("ps -axo pid,ppid,%cpu,rss,comm | rg -i 'ollama|VirtualMachine|Chrome|chromium'"),
        'gpu': run("ioreg -r -c AGXAccelerator -l | rg 'PerformanceStatistics'"),
        'swap': run('sysctl vm.swapusage'), 'vm': run('vm_stat'),
        'docker': run("docker stats --no-stream --format '{{json .}}'"),
        'cgroup': run("docker exec repo-gods-eye-view-1 sh -c 'cat /sys/fs/cgroup/memory.current /sys/fs/cgroup/memory.stat'"),
        'container_rss': run('docker top repo-gods-eye-view-1 -eo pid,rss,comm'),
        'ollama': api('http://localhost:11434/api/ps')}

if __name__ == '__main__':
    commands = [
        'date -Iseconds; sw_vers; uname -m; sysctl hw.model hw.memsize hw.ncpu machdep.cpu.brand_string',
        'system_profiler SPDisplaysDataType', 'df -h .',
        'du -sh .. . node_modules .gev-cache .git public src server data 2>/dev/null',
        'du -sk .. . node_modules .gev-cache .git public src server 2>/dev/null',
        'du -ak .gev-cache | sort -n',
        'docker version', 'docker images', 'docker system df',
        "docker image inspect --format '{{.Architecture}} {{.Os}} {{.Size}}' repo-gods-eye-view",
        "docker inspect --format '{{.Created}} {{.State.StartedAt}} Memory={{.HostConfig.Memory}} NanoCpus={{.HostConfig.NanoCpus}}' repo-gods-eye-view-1",
        "docker info --format 'CPUs={{.NCPU}} Memory={{.MemTotal}} OS={{.OperatingSystem}} Architecture={{.Architecture}}'",
        "docker volume ls --format '{{.Name}}'",
        'ollama --version; ollama list; ollama ps',
        'git rev-parse HEAD; git status --short',
        'du -sh /Users/lanss/.ollama/models',
    ]
    result = {'time': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'commands': [run(c) for c in commands]}
    show = api('http://localhost:11434/api/show', {'model':'gemma4:e4b'})
    result['model'] = {k:v for k,v in show.items() if k not in ['license','modelfile','template']}
    result['model_tags'] = api('http://localhost:11434/api/tags')
    result['track_summary'] = api('http://localhost:4173/api/taiwan-vessel-tracks?mode=summary')
    result['baseline'] = telemetry()
    # Source = working tree excluding dependencies, git history and runtime caches.
    excluded = {'node_modules','.git','.gev-cache','.gev-logs','docs/resource-evaluation'}
    count = logical = allocated = 0
    for p in ROOT.rglob('*'):
        rel = p.relative_to(ROOT)
        if any(x in rel.parts for x in excluded) or str(rel).startswith('docs/resource-evaluation'): continue
        if p.is_file() and not p.is_symlink():
            s=p.stat(); count+=1; logical+=s.st_size; allocated+=s.st_blocks*512
    result['source_working_tree']={'files':count,'logical_bytes':logical,'allocated_bytes':allocated,'excluded':sorted(excluded)}
    (OUT/'host.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps({'source':result['source_working_tree'],'model':result['model']['details'],
        'tracks':result['track_summary']},ensure_ascii=False,indent=2))
