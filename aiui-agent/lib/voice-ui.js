// Frontend-only presentation and RV101 key normalization. No transport credentials here.
export const BUSY_STATES = ['TRANSCRIBING', 'THINKING', 'WORKING'];
export const LABELS = { READY: '● Готов', LISTENING: '● Слушаю', TRANSCRIBING: '● Распознаю', THINKING: '● Думаю', WORKING: '● Выполняю', DONE: '● Готово', ERROR: '● Ошибка' };
export function briefAnswer(text, limit = 300) {
  const plain = String(text || '').replace(/```[\s\S]*?```/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim();
  if (!plain) return text ? 'Ответ содержит код. Полный текст ниже.' : '';
  if (plain.length <= limit) return plain;
  const sentences = plain.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [];
  let brief = '';
  for (const sentence of sentences.slice(0, 2)) { if ((brief + sentence).length > limit) break; brief += sentence; }
  if (brief.trim()) return brief.trim();
  const cut = plain.slice(0, limit - 1); const boundary = cut.lastIndexOf(' ');
  return cut.slice(0, boundary > limit / 2 ? boundary : cut.length).trim() + '…';
}
const ERROR_MESSAGES = {
  codex_not_ready: 'Codex недоступен на Mac', codex_unavailable: 'Codex недоступен на Mac', resume_failed: 'Codex недоступен на Mac',
  network_or_tls_error: 'Нет связи с Mac', unauthorized: 'Доступ к Mac отклонён', stt_failed: 'Не удалось распознать речь',
  stt_not_configured: 'Распознавание на Mac недоступно', stt_busy: 'Распознавание занято. Повторите позже', no_speech: 'Речь не обнаружена',
  microphone_unavailable: 'Микрофон недоступен', recording_failed: 'Запись прервана', invalid_audio_size: 'Слишком короткая запись',
  session_busy_or_uncertain: 'Нужно проверить задачу на Mac', turn_delivery_uncertain: 'Нужно проверить доставку на Mac',
  recovery_requires_local_review: 'Нужно проверить задачу на Mac', pending_request_needs_review: 'Нужно проверить задачу на Mac',
  session_mismatch: 'Диалог изменился. Проверьте Mac', thread_mismatch: 'Диалог изменился. Проверьте Mac',
  session_not_found: 'Диалог не найден на Mac', connection_not_configured: 'Подключение к Mac не настроено',
  invalid_response: 'Не удалось прочитать ответ Mac', invalid_snapshot: 'Не удалось прочитать ответ Mac',
  client_error: 'Не удалось выполнить запрос', gateway_error: 'Ошибка на Mac', turn_interrupted: 'Задача остановлена'
};
export function errorView(reason) {
  const code = Object.hasOwn(ERROR_MESSAGES, reason) ? reason : 'client_error';
  return { title: ERROR_MESSAGES[code], reason: '', code };
}
export class TempleControls {
  constructor({ tap, exit, scroll, trace = () => {}, now = Date.now }) {
    Object.assign(this, { tap, exit, scroll, trace, now }); this.lastTap = -Infinity; this.closed = false; this.globalDownSeen = false;
  }
  handle(edge, event) {
    const code = event.code;
    if (!['GlobalHook', 'Enter', 'Backspace', 'ArrowUp', 'ArrowDown'].includes(code)) return;
    this.trace({ edge, code });
    if (code === 'Backspace') {
      // Keep the official host Back action. It closes the root page/agent.
      if (!this.closed) { this.closed = true; this.exit(); }
      return;
    }
    if (this.closed) return;
    if (code === 'ArrowUp' || code === 'ArrowDown') {
      if (edge === 'up') { event.preventDefault?.(); this.scroll(code === 'ArrowDown' ? 1 : -1); }
      return;
    }
    if (edge === 'up') event.preventDefault?.();
    if (code === 'GlobalHook' && edge === 'up' && this.globalDownSeen) { this.globalDownSeen = false; this.lastTap = this.now(); return; }
    if (code === 'GlobalHook' && edge === 'down') this.globalDownSeen = true;
    if (event.repeat || (code === 'Enter' && edge !== 'up')) return;
    // GlobalHook can be down-only, up-only, or accompany Enter on RV101.
    // Start microphone synchronously in the user event; never defer start into a timer.
    const time = this.now();
    if (time - this.lastTap < 650) return;
    this.lastTap = time; this.tap();
  }
}
