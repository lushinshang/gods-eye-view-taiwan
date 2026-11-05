"""Two bounded inference requests, with concurrent host telemetry. No model changes."""
import datetime, json, threading, time
from host import OUT, api, telemetry, run

def benchmark():
    result={'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'before':telemetry(), 'requests':[]}
    for label in ['cold','warm']:
        samples=[]; stop=threading.Event()
        def monitor():
            while not stop.is_set():
                try: samples.append(telemetry())
                except Exception as e: samples.append({'error':str(e)})
                stop.wait(1)
        thread=threading.Thread(target=monitor,daemon=True); thread.start()
        started=time.monotonic()
        payload={'model':'gemma4:e4b','stream':False,'think':False,'keep_alive':'5m',
                 'messages':[{'role':'user','content':'請用繁體中文撰寫約五百字的海陸態勢觀測作業說明，包含船舶 AIS 資料時效、航跡異常與高速公路事件的檢核步驟。這是效能測試，請勿虛構即時事實。'}],
                 'options':{'temperature':0,'num_predict':256}}
        item={'label':label,'options':payload['options'],'think':False}
        try:
            d=api('http://localhost:11434/api/chat',payload,timeout=150)
            item['metrics']={k:v for k,v in d.items() if k not in ['message']}
            item['response_chars']=len(d.get('message',{}).get('content',''))
            item['tokens_per_second']=d.get('eval_count',0)/(d.get('eval_duration',1)/1e9)
        except Exception as e: item['error']=str(e)
        finally:
            item['wall_seconds']=time.monotonic()-started
            stop.set(); thread.join(timeout=15)
        item['samples']=samples; item['after']=telemetry()
        item['ollama_ps']=run('ollama ps')
        result['requests'].append(item)
        (OUT/'ollama.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
        print(json.dumps({k:v for k,v in item.items() if k not in ['samples','after']},ensure_ascii=False),flush=True)
    return result

if __name__=='__main__': benchmark()
