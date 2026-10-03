<script def>
{
  "navigationBarTitleText": "Jarvis",
  "description": "Open the Jarvis voice terminal in READY state. The user taps the temple to dictate a task. Opening the agent is not a task.",
  "schema": {"data": {"type": "object", "properties": {}}}
}
</script>
<script setup>
import { ApprovalCard } from '../../lib/approval-ui.js';
import config from '../../config.js';
import { Latency } from '../../lib/latency.js';
import { OneShotAudioSession, PcmVoiceActivityDetector, VOICE_ACTIVITY_LIMITS } from '../../lib/one-shot-audio.js';
import { pcmToWav } from '../../lib/wav.js';
import { Conversation, createTransport } from '../../lib/gateway.js';
import { TempleControls, StatusPulse, ACTIVE_STATES, LABELS, BUSY_STATES, briefAnswer, errorView } from '../../lib/voice-ui.js';

export default {
  data: { approval:null, approvalAllow:false, approvalSecond:false, approvalSubmitting:false, approvalRemainingSeconds:0, approvalFeedback:'', phase: 'THINKING', label: 'Подключаюсь', statusActive: false, statusOpacity: 1, history: [], errorText: '', hint: '', scroll: 0, scrollTarget: '' },
  onLoad() {
    this.pageEpoch = 0; this.visible = false; this.spokenTurn = null; this.awaitingStop = false; this.trace = [];
    this.approvalCard = new ApprovalCard({decide:(...args)=>this.client.decideApproval(...args),render:(value,done)=>typeof done==='function'?this.setData(value,done):this.setData(value),speak:text=>this.speak(text)});
    this.audio = new OneShotAudioSession({
      limits: { sampleRate: 16000, channels: 1, bytesPerSample: 2, maxDurationMs: 30000, maxBytes: 960000 },
      voiceDetector: new PcmVoiceActivityDetector({ limits: { ...VOICE_ACTIVITY_LIMITS, automaticStopOnSilence: false } })
    });
    try {
      this.latency = new Latency({storage:{set:(k,v)=>wx.setStorageSync(k,v)},transport:createTransport(wx,config),id:()=>crypto.randomUUID()});
      this.client = new Conversation({ diagnostics: this.latency, config, transport: createTransport(wx, config),
        storage: { get: key => wx.getStorageSync(key), set: (key, value) => wx.setStorageSync(key, value) },
        id: () => crypto.randomUUID(), render: value => this.renderState(value) });
      this.recorder = wx.media.getRecorderManager();
      if (this.recorder) this.bindRecorder();
    } catch (_) { this.showError('connection_not_configured'); }
  },
  onShow() {
    this.visible = true;
    this.controls = new TempleControls({ tap: () => this.tap(), exit: () => { this.approvalCard?.exit(); this.cleanup(); },
      scroll: direction => { if(this.data.phase==='APPROVAL'){this.approvalCard.move(direction);return;} if (this.data.history.length) this.setData({ scrollTarget: '', scroll: Math.max(0, (this.scrollPosition || 0) + direction * 110) }); },
      trace: entry => {
        // Only key codes/state, never speech, prompts, credentials or answers.
        this.trace.push({ ...entry, phase: this.data.phase, at: Date.now() });
        this.trace = this.trace.slice(-32);
        try { wx.setStorageSync('mac-codex-temple-trace', this.trace); } catch (_) {}
      } });
    if (this.client) this.client.open();
  },
  setPhaseData(value, done) {
    // Keep essential state/history separate from optional native motion updates.
    const update={...value,label:LABELS[value.phase] || LABELS.ERROR};
    if (typeof done === 'function') this.setData(update,done);
    else this.setData(update);
    try {
      if (!this.pulse) this.pulse=new StatusPulse(opacity => this.setData({statusOpacity:opacity}));
      const active=this.visible && ACTIVE_STATES.includes(value.phase);
      this.setData({statusActive:active});
      this.pulse.setActive(active);
    } catch (_) {
      // A presentation failure must never interrupt client.open, recording or TTS.
      this.pulse?.stop();
    }
  },
  renderState(value) {
    if (!this.visible) return;
    const history = value.history || this.data.history;
    const latest = history.at(-1);
    const revision = latest ? latest.requestId + ':' + latest.completed + ':' + latest.assistant.length : '';
    const changed = revision !== this.historyRevision;
    this.historyRevision = revision;
    const update = { history, ...(changed && latest ? { scrollTarget: 'exchange-' + latest.requestId } : {}) };
    if (value.state === 'ERROR') { this.approvalCard.clear(); this.setData(update); this.showError(value.detail); if(!value.busy&&latest?.turnId===value.turnId&&latest.assistant)this.setData({errorText:briefAnswer(latest.assistant)}); this.speakOutcome(value,latest); return; }
    const phase = value.state;
    if(phase!=='APPROVAL'&&this.approvalCard.current)this.approvalCard.clear();
    this.setPhaseData({ ...update, phase, label: LABELS[phase] || LABELS.ERROR, errorText: phase==='CANCELLED'?(value.approvalMessage||briefAnswer(latest?.assistant)):phase==='STOPPING'?(value.approvalReason==='unsupported'?'Подтверждение недоступно. Останавливаю…':value.approvalReason==='timeout'?'Время подтверждения истекло. Останавливаю…':'Действие отклонено. Останавливаю…'):'',
      hint: phase === 'READY' ? 'Нажмите на дужку и говорите' :
        ['DONE','CANCELLED'].includes(phase) ? 'Нажмите для следующей реплики' :
        phase === 'APPROVAL' ? 'Свайп — выбор · Нажатие — подтвердить' :
        BUSY_STATES.includes(phase) ? (value.detail === 'Останавливаю…' ? value.detail : 'Нажатие — отмена') : '' }, () => {
        if (phase === 'DONE' && this.latency?.sample?.turnId === value.turnId && this.latency.sample.T9 && !this.latency.sample.T10) { this.latency.mark('T10'); this.latency.finish(); }
      });
    if(phase==='APPROVAL'&&value.approval)this.approvalCard.show(value.approval);
    this.speakOutcome(value,latest);
  },
  speakOutcome(value,latest) {
    if(value.restoring||!value.turnId)return;
    const terminal=!value.busy&&['DONE','ERROR','CANCELLED'].includes(value.state);
    const spokenKey=value.turnId+':'+latest?.outcome+':'+latest?.assistant;
    if(terminal&&latest?.turnId===value.turnId&&latest.assistant&&this.spokenOutcomeKey!==spokenKey){
      this.spokenOutcomeKey=spokenKey;this.spokenTurn=value.turnId;this.speak(briefAnswer(latest.assistant));
    }
  },
  handleScroll(event) {
    const top = event.detail?.scrollTop;
    if (Number.isFinite(top)) this.scrollPosition = Math.max(0, top);
  },
  showError(reason) {
    const error = errorView(reason);
    this.safeError = error.code; this.latency?.finish(error.code);
    try { wx.setStorageSync('mac-codex-last-error', {code:error.code,at:Date.now()}); } catch (_) {}
    this.setPhaseData({ phase: 'ERROR', label: LABELS.ERROR, errorText: error.title,
      hint: 'Нажмите, чтобы подключиться' });
  },
  bindRecorder() {
    this.recorder.onFrameRecorded(payload => {
      if (!this.visible || !payload?.frameBuffer || this.audio.phase !== 'recording') return;
      this.audio.appendFrame(payload.frameBuffer);
      if (this.audio.phase === 'cancelled') this.recordingError('invalid_audio_size');
    });
    this.recorder.onStop(() => {
      this.awaitingStop = false;
      if (!this.visible || !['recording', 'stopping'].includes(this.audio.phase)) return;
      if (!this.audio.voiceDetector.summary().speechDetected) { this.audio.cancel('no_speech', { stopRecorder: false }); this.showError('no_speech'); return; }
      this.latency?.begin();
      const epoch = this.pageEpoch;
      // A second tap can become Backspace. Give the host time to classify it before sending.
      this.sendTimer = setTimeout(() => {
        this.sendTimer = null;
        if (!this.visible || epoch !== this.pageEpoch) return;
        try {
          const pending = this.audio.recorderStopped(({ audio }) => {
            const wav = pcmToWav(audio); audio.fill(0);
            return this.client.audio(wav).finally(() => new Uint8Array(wav).fill(0));
          });
          if (pending) pending.then(() => this.audio.markDone()).catch(() => this.recordingError('recording_failed'));
        } catch (_) { this.recordingError('invalid_audio_size'); }
      }, 650);
    });
    this.recorder.onError(() => { this.awaitingStop = false; this.recordingError('recording_failed'); });
    this.recorder.onInterruptionBegin(() => this.recordingError('recording_failed'));
  },
  tap() {
    if (!this.visible || !this.client) return;
    if (this.data.phase === 'APPROVAL') { this.approvalCard.tap(); return; }
    if (this.data.phase === 'LISTENING') { this.audio.finishRecording(); return; }
    if (BUSY_STATES.includes(this.data.phase)) {
      if (this.sendTimer || this.audio.phase === 'stopping') { clearTimeout(this.sendTimer); this.sendTimer = null; this.audio.cancel('cancelled', { stopRecorder: false }); this.renderState({state:'READY'}); }
      else this.client.stop();
      return;
    }
    if (this.data.phase === 'ERROR') { this.client.open(); return; }
    if (!['READY', 'DONE','CANCELLED'].includes(this.data.phase) || this.awaitingStop || this.client.operation) return;
    if (!this.recorder) { this.showError('microphone_unavailable'); return; }
    this.stopSpeech(); this.latency.sample = null; this.audio.reset(); this.awaitingStop = true;
    this.audio.begin({ requestId: crypto.randomUUID(), stopRecorder: () => {
      if (this.visible) this.setPhaseData({ phase: 'TRANSCRIBING', label: LABELS.TRANSCRIBING, errorText: '', hint: 'Нажатие — отмена' });
      this.recorder.stop().catch(() => { this.awaitingStop = false; this.recordingError('recording_failed'); });
    }});
    this.setPhaseData({ phase: 'LISTENING', label: LABELS.LISTENING, errorText: '', hint: 'Нажмите, чтобы отправить' });
    // Invocation only opens READY. Microphone acquisition stays inside this physical input event.
    this.recorder.start({ sampleRate: 16000, numberOfChannels: 1, format: 'pcm' }).catch(() => { this.awaitingStop = false; this.recordingError('microphone_unavailable'); });
  },
  recordingError(reason) { this.audio.cancel('error'); if (this.visible) this.showError(reason); },
  async speak(text) {
    if (!config.tts) return;
    this.stopSpeech(); const epoch = this.pageEpoch;
    try {
      if (typeof speechSynthesis === 'undefined' || typeof speechSynthesis.synthesize !== 'function' || typeof SpeechAudioPlayer === 'undefined') throw new Error('unsupported');
      const task = await speechSynthesis.synthesize(new SpeechSynthesisUtterance(text));
      task.finished.catch(() => {});
      if (!this.visible || epoch !== this.pageEpoch) { task.abort(); return; }
      this.speechTask = task; this.player = new SpeechAudioPlayer(task); this.player.play();
      if (this.latency?.sample?.turnId === this.spokenTurn) { this.latency.mark('T11'); this.latency.finish(); }
    } catch (_) { if (this.visible && epoch === this.pageEpoch) this.setData({ hint: this.data.phase==='APPROVAL'?'Свайп — выбор · Нажатие — подтвердить':'TTS недоступен · Нажмите для следующей реплики' }); }
  },
  stopSpeech() {
    this.pageEpoch++;
    if (this.player) { try { this.player.destroy(); } catch (_) {} this.player = null; }
    if (this.speechTask) { try { this.speechTask.abort(); } catch (_) {} this.speechTask = null; }
  },
  onKeyDown(event) { this.controls?.handle('down', event); },
  onKeyUp(event) { this.controls?.handle('up', event); },
  cleanup() {
    this.approvalCard?.exit();
    this.visible = false; this.controls?.dispose();
    if (this.sendTimer) clearTimeout(this.sendTimer); this.sendTimer = null;
    this.audio?.cancel('hidden'); this.stopSpeech(); this.client?.close();
    this.pulse?.stop();
    try { this.setData({statusActive:false}); } catch (_) {}
  },
  onHide() { this.cleanup(); },
  onUnload() { this.cleanup(); }
};
</script>
<page>
  <view class="screen {{approval ? 'approval-screen' : ''}}">
    <text ink:if="{{!approval}}" class="brand">Jarvis</text>
    <view class="status-line">
      <view class="status-point {{statusActive ? 'status-moving' : ''}}" style="opacity:{{statusOpacity}}"></view>
      <text class="state">{{label}}</text>
    </view>
    <text ink:if="{{errorText}}" class="error">{{errorText}}</text>
    <view ink:if="{{approval}}" class="approval-card">
      <text ink:if="{{approvalSecond}}" class="approval-confirm">ПОДТВЕРДИТЬ ДЕЙСТВИЕ?</text>
      <text ink:if="{{!approvalSecond}}" class="approval-action">{{approval.title}} · {{approval.action}}</text>
      <text class="body">{{approval.target}}</text>
      <text class="approval-scope">{{approvalRemainingSeconds}}с · {{approval.risk === 'high' ? 'Повышенный риск · ' : ''}}{{approval.scope === 'turn' ? 'Доступ до конца текущего запроса' : 'Только это действие'}}</text>
      <text class="approval-choice">{{approvalAllow ? '  ' : '› '}}{{approvalSecond ? 'НЕТ' : 'ОТКЛОНИТЬ'}}</text>
      <text class="approval-choice">{{approvalAllow ? '› ' : '  '}}{{approvalSecond ? 'ДА, ВЫПОЛНИТЬ' : approval.scope === 'turn' ? 'РАЗРЕШИТЬ НА ЭТОТ ЗАПРОС' : 'РАЗРЕШИТЬ ОДИН РАЗ'}}</text>
      <text ink:if="{{approvalFeedback}}" class="hint">{{approvalFeedback}}</text>
      <text ink:if="{{approvalSubmitting}}" class="hint">Отправляю решение…</text>
    </view>
    <scroll-view ink:if="{{!approval}}" class="answer" scroll-y="true" scroll-top="{{scroll}}" scroll-into-view="{{scrollTarget}}" bindscroll="handleScroll">
      <view class="content">
        <view ink:for="{{history}}" ink:key="requestId" id="exchange-{{item.requestId}}" class="exchange">
          <text class="speaker">ВЫ</text>
          <text class="body">{{item.user}}</text>
          <text ink:if="{{item.assistant}}" class="speaker">JARVIS</text>
          <text ink:if="{{item.assistant}}" class="body">{{item.assistant}}</text>
        </view>
      </view>
    </scroll-view>
    <text class="hint">{{hint}}</text>
  </view>
</page>
<style>
.screen { display: flex; flex-direction: column; height: 100vh; box-sizing: border-box; padding: 16px; gap: 10px; --primary:#40ff5e; --secondary:rgba(64,255,94,0.6); --divider:rgba(64,255,94,0.4); background-color: #000000; color:var(--primary); }
.brand { font-size: 16px; }
.status-line { display:flex; flex-direction:row; align-items:center; gap:8px; }
.status-point { width:8px; height:8px; border-radius:9999px; background-color:var(--primary); }
.status-moving { transition-property:opacity; transition-duration:450ms; transition-timing-function:ease-in-out; }
.state { font-size:20px; font-weight:700; }
.answer { width: 100%; flex-grow: 1; flex-shrink: 1; flex-basis: 0px; }
.content, .exchange { display:flex; flex-direction:column; width:100%; }
.content { gap:12px; }
.exchange { gap:4px; padding-top:8px; margin-bottom:8px; border-top:1px solid var(--divider); }
.error, .body { width:100%; font-size:19px; font-weight:400; line-height:1.35; }
.body { margin-bottom:8px; }
.speaker { font-family:monospace; font-size:23px; font-weight:700; line-height:1.1; color:var(--primary); }
.approval-card { display:flex; flex-direction:column; gap:6px; border-top:1px solid var(--divider); padding-top:8px; }
.approval-choice { font-size:17px; font-weight:700; line-height:1.05; }
.approval-screen { padding:6px; gap:2px; }
.approval-screen .state { font-size:18px; line-height:1.1; }
.approval-screen .approval-card { gap:1px; padding-top:1px; }
.approval-screen .body { font-family:monospace; font-size:14px; line-height:1.05; margin-bottom:0px; }
.approval-screen .hint { font-size:10px; line-height:1.05; }
.approval-action { font-size:13px; line-height:1.05; }
.approval-scope { font-size:11px; line-height:1.05; }
.approval-confirm { font-size:13px; font-weight:700; line-height:1.05; }
.hint { font-size: 16px; color: var(--secondary); }
</style>
