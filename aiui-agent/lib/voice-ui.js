// Frontend-only presentation and RV101 key normalization. No transport credentials here.
export const BUSY_STATES = ['TRANSCRIBING', 'THINKING', 'WORKING'];
export const LABELS = { READY: 'Готов', LISTENING: 'Слушаю', TRANSCRIBING: 'Распознаю', THINKING: 'Думаю', WORKING: 'Выполняю', DONE: 'Готово', ERROR: 'Ошибка' };
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
  gateway_history_unavailable: 'Обновите gateway на Mac',
  client_error: 'Не удалось выполнить запрос', gateway_error: 'Ошибка на Mac', turn_interrupted: 'Задача остановлена'
};
export function errorView(reason) {
  const code = Object.hasOwn(ERROR_MESSAGES, reason) ? reason : 'client_error';
  return { title: ERROR_MESSAGES[code], reason: '', code };
}
export const ACTIVE_STATES = ['LISTENING', ...BUSY_STATES];
export class StatusPulse {
  constructor(update, {schedule=setInterval, unschedule=clearInterval}={}) {
    Object.assign(this,{update,schedule,unschedule}); this.timer=null;this.active=false;this.bright=false;
  }
  setActive(active) {
    if(this.active===active)return;
    this.active=active;
    if(this.timer!==null){this.unschedule(this.timer);this.timer=null;}
    if(!active){this.update(1);return;}
    this.bright=false;this.update(0.4);
    this.timer=this.schedule(()=>{if(!this.active)return;this.bright=!this.bright;this.update(this.bright?1:0.4)},600);
  }
  stop(){this.setActive(false);}
}
export class TempleControls {
  constructor({tap,exit,scroll,trace=()=>{}}) {
    Object.assign(this,{tap,exit,scroll,trace});this.closed=false;
  }
  handle(edge,event) {
    const code=event.code;
    if(!['down','up'].includes(edge)||!['GlobalHook','Enter','Backspace','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code))return;
    this.trace({edge,code});
    if(this.closed)return;
    if(code==='Backspace') {
      // Clean up once; never prevent the host's native key-up back/exit action.
      this.closed=true;this.exit();return;
    }
    // Generic temple contact precedes swipes: it is NEVER a voice/cancel action.
    if(code==='GlobalHook'||edge!=='up'||event.repeat)return;
    event.preventDefault?.();
    if(code==='Enter'){this.tap();return;}
    // Horizontal codes, when supplied by a host, are harmless navigation aliases.
    this.scroll(code==='ArrowUp'||code==='ArrowLeft'?-1:1);
  }
  dispose(){this.closed=true;}
}
