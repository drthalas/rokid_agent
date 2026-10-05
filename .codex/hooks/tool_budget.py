#!/usr/bin/env python3
"""ALE-467: session-scoped budget for supported Codex local tool hooks."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile

UI = re.compile(r'cua|computer[_ -]?use|browser|playwright|selenium|puppeteer|capture_screen|screenshot', re.I)

def result(event, reason):
    if event == 'PreToolUse':
        return {'hookSpecificOutput': {'hookEventName': event, 'permissionDecision': 'deny', 'permissionDecisionReason': reason}}
    return {'continue': False, 'stopReason': reason}

def handle(data, limits, state_dir):
    event = data.get('hook_event_name')
    if event not in ('PreToolUse', 'PostToolUse'):
        raise ValueError('unsupported hook event')
    session = data.get('session_id')
    if not isinstance(session, str) or not session:
        raise ValueError('missing session_id')
    total, ui_limit = limits['tool_calls'], limits['ui_calls']
    if type(total) is not int or total < 1 or type(ui_limit) is not int or ui_limit < 0:
        raise ValueError('invalid limits')
    key = hashlib.sha256((str(Path(data['cwd']).resolve()) + '\0' + session).encode()).hexdigest()
    state_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    path = state_dir / (key + '.json')
    with (state_dir / (key + '.lock')).open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        state = json.loads(path.read_text()) if path.exists() else {'tool_calls': 0, 'ui_calls': 0, 'seen': [], 'stopped': False}
        if state['stopped'] or state['tool_calls'] >= total:
            return result(event, 'ALE-467 tool budget exhausted')
        name = data.get('tool_name', '')
        command = data.get('tool_input', {}).get('command', '') if isinstance(data.get('tool_input'), dict) else ''
        is_ui = bool(UI.search(name) or (name in ('Bash', 'exec_command') and UI.search(command)))
        if event == 'PreToolUse':
            if is_ui and state['ui_calls'] >= ui_limit:
                return result(event, 'ALE-467 UI budget exhausted; use CLI/API/MCP')
            call_id = data.get('tool_use_id')
            if not call_id or call_id not in state['seen']:
                state['tool_calls'] += 1
                state['ui_calls'] += int(is_ui)
                if call_id:
                    state['seen'].append(call_id)
                temp = path.with_suffix('.tmp')
                temp.write_text(json.dumps(state))
                os.replace(temp, path)
            return {}
        return {}

def main():
    data = {}
    try:
        data = json.load(sys.stdin)
        if not isinstance(data, dict):
            data = {}
            raise ValueError('invalid hook input')
        root = Path(__file__).resolve().parent
        limits = json.loads((root / 'limits.json').read_text())
        state_dir = Path(tempfile.gettempdir()) / ('rokid-codex-tool-budget-' + str(os.getuid()))
        output = handle(data, limits, state_dir)
    except Exception:
        output = result(data.get('hook_event_name', 'PreToolUse'), 'ALE-467 budget guard unavailable; blocked')
    print(json.dumps(output))

if __name__ == '__main__':
    main()
