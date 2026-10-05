"""Safe dispatcher fixture: denied actions must never execute."""
import concurrent.futures
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('guard', Path(__file__).resolve().parents[1] / '.codex/hooks/tool_budget.py')
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)

class BudgetTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name)
        self.limits = {'tool_calls': 3, 'ui_calls': 1}
        self.executed = []

    def invoke(self, number, name='Bash', session='fixture'):
        data = {'hook_event_name':'PreToolUse', 'session_id':session, 'cwd':str(self.path), 'tool_name':name, 'tool_use_id':str(number)}
        decision = guard.handle(data, self.limits, self.path / 'state')
        if not decision:
            self.executed.append(number)
        return decision

    def test_fourth_action_never_executes_and_post_stops(self):
        for n in range(3):
            self.assertEqual(self.invoke(n), {})
        self.assertEqual(self.invoke(3)['hookSpecificOutput']['permissionDecision'], 'deny')
        self.assertEqual(self.executed, [0, 1, 2])
        data = {'hook_event_name':'PostToolUse', 'session_id':'fixture', 'cwd':str(self.path)}
        self.assertFalse(guard.handle(data, self.limits, self.path / 'state')['continue'])

    def test_ui_cap_preserves_cli_capacity(self):
        self.assertEqual(self.invoke(0, 'mcp__cua_repl__js'), {})
        self.assertIn('deny', self.invoke(1, 'mcp__browser__click')['hookSpecificOutput'].values())
        self.assertEqual(self.invoke(2), {})
        self.assertEqual(self.executed, [0, 2])

    def test_parallel_reservations_cannot_exceed_cap(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            decisions = list(pool.map(self.invoke, range(25)))
        self.assertEqual(sum(not d for d in decisions), 3)

    def test_session_isolation_and_dedup(self):
        self.invoke(0); self.invoke(0)
        self.invoke(1); self.invoke(2)
        self.assertTrue(self.invoke(3))
        self.assertEqual(self.invoke(0, session='other'), {})

if __name__ == '__main__':
    unittest.main()
