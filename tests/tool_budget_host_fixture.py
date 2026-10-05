"""No account/inference: local fake Responses server drives the installed CLI."""
import http.server
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='ale467-host-') as tmp:
    folder = Path(tmp)
    hookdir = folder / '.codex/hooks'
    hookdir.mkdir(parents=True)
    shutil.copy(ROOT / '.codex/hooks/tool_budget.py', hookdir)
    (hookdir / 'limits.json').write_text('{"tool_calls":1,"ui_calls":0}')
    (folder / '.codex/hooks.json').write_text((ROOT / '.codex/hooks.json').read_text())
    subprocess.run(['git','init','-q',str(folder)],check=True)
    requests = []
    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def do_GET(self):
            self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers()
            self.wfile.write(b'{"data":[{"id":"fixture","object":"model"}]}')
        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            requests.append(1)
            n = len(requests)
            item = {'type':'function_call','id':f'fc_{n}','call_id':f'call_{n}','name':'exec_command','arguments':json.dumps({'cmd':f'touch {folder}/action-{n}','max_output_tokens':100})}
            if n > 2:
                item = {'type':'message','id':f'msg_{n}','role':'assistant','status':'completed','content':[{'type':'output_text','text':'Fixture complete.'}]}
            response = {'id':f'resp_{n}','object':'response','status':'completed','output':[item],'usage':{'input_tokens':10,'output_tokens':10,'total_tokens':20}}
            events = [
                {'type':'response.created','response':dict(response,status='in_progress',output=[])},
                {'type':'response.output_item.added','output_index':0,'item':dict(item,arguments='')},
                {'type':'response.function_call_arguments.delta','item_id':item['id'],'output_index':0,'delta':item.get('arguments','')},
                {'type':'response.function_call_arguments.done','item_id':item['id'],'output_index':0,'arguments':item.get('arguments','')},
                {'type':'response.output_item.done','output_index':0,'item':item},
                {'type':'response.completed','response':response}]
            if n > 2:
                events = [{'type':'response.created','response':dict(response,status='in_progress',output=[])}, {'type':'response.output_item.done','output_index':0,'item':item}, {'type':'response.completed','response':response}]
            self.send_response(200);self.send_header('Content-Type','text/event-stream');self.end_headers()
            for e in events:self.wfile.write(('data: '+json.dumps(e)+'\n\n').encode())
            self.wfile.flush()
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    command=['codex','exec','--json','--ephemeral','--dangerously-bypass-hook-trust','-C',str(folder),'-s','workspace-write','-c','mcp_servers={}','-c','features.plugins=false','-c','features.apps=false','-c','model_provider="fixture"','-c','model="fixture"','-c','model_providers.fixture.name="fixture"','-c',f'model_providers.fixture.base_url="http://127.0.0.1:{server.server_port}/v1"','-c','model_providers.fixture.wire_api="responses"','-c','model_providers.fixture.requires_openai_auth=false','-c','model_providers.fixture.supports_websockets=false','Run fixture tool.']
    try:
        try:
            proc=subprocess.run(command,text=True,capture_output=True,timeout=20)
        except subprocess.TimeoutExpired as e:
            print(json.dumps({'timeout':True,'mock_requests':len(requests),'stdout':(e.stdout or b'').decode(errors='replace')[-3000:],'stderr':(e.stderr or b'').decode(errors='replace')[-1500:]}))
            raise
        print(json.dumps({'exit':proc.returncode,'mock_requests':len(requests),'first_action':(folder/'action-1').exists(),'second_action':(folder/'action-2').exists(),'hook_seen':'hook' in proc.stdout.lower(),'stdout_tail':proc.stdout[-3500:],'stderr_tail':proc.stderr[-1500:]}))
        assert (folder/'action-1').exists(), 'first action did not execute'
        assert not (folder/'action-2').exists(), 'second action executed after cap'
        assert len(requests)==3, 'fixture did not complete the denied-call path'
        assert 'ALE-467 tool budget exhausted' in proc.stderr, 'native host did not report hook denial'
        print('PASS: native PreToolUse denied second action before execution; PostToolUse stop is not claimed')
    finally:server.shutdown()
