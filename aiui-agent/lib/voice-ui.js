// Frontend-only presentation and RV101 key normalization. No transport credentials here.
export const BUSY_STATES = ['TRANSCRIBING', 'THINKING', 'WORKING', 'STOPPING'];
export const LABELS = { STOPPING:'Останавливаю', CANCELLED:'Не выполнено', APPROVAL: 'Требуется подтверждение', READY: 'Готов', LISTENING: 'Слушаю', TRANSCRIBING: 'Распознаю', THINKING: 'Думаю', WORKING: 'Выполняю', DONE: 'Готово', ERROR: 'Ошибка' };
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
  no_final_answer:'Codex не вернул итоговый ответ',
  approval_unavailable: 'Это подтверждение недоступно на очках', approval_not_current: 'Подтверждение уже закрыто',
  approval_completion_uncertain: 'Действие отклонено. Состояние задачи нужно проверить на Mac',
  gateway_history_unavailable: 'Обновите gateway на Mac',
  client_error: 'Не удалось выполнить запрос', gateway_error: 'Ошибка на Mac', turn_interrupted: 'Задача остановлена'
};
export function errorView(reason) {
  const code = Object.hasOwn(ERROR_MESSAGES, reason) ? reason : 'client_error';
  return { title: ERROR_MESSAGES[code], reason: '', code };
}
export const ACTIVE_STATES = ['LISTENING', ...BUSY_STATES];
export class StatusPulse {
  constructor(update, {schedule=setTimeout, unschedule=clearTimeout}={}) {
    Object.assign(this,{update,schedule,unschedule}); this.timer=null;this.active=false;this.bright=false;this.epoch=0;
  }
  setActive(active) {
    if(this.active===active)return;
    if(!active){this.stop();return;}
    this.active=true;this.bright=false;
    const epoch=++this.epoch;
    const tick=()=>{
      if(!this.active || this.epoch!==epoch)return;
      this.timer=null;
      try {
        this.bright=!this.bright;this.update(this.bright?1:0.4);
        this.timer=this.schedule(tick,600);
      } catch (_) { this.stop(); }
    };
    try { this.update(0.4);this.timer=this.schedule(tick,600); }
    catch (_) { this.stop(); }
  }
  stop(){
    this.active=false;this.epoch++;
    const timer=this.timer;this.timer=null;
    if(timer!==null){try{this.unschedule(timer)}catch(_){}}
    try{this.update(1)}catch(_){} // Static marker fallback; never propagate native UI errors.
  }
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
