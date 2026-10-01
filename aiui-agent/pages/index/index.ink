<script def>
{
  "navigationBarTitleText": "Mac Codex",
  "description": "Open the Mac Codex voice terminal in READY state. The user taps the temple to dictate a task. Opening the agent is not a task.",
  "schema": {"data": {"type": "object", "properties": {}}}
}
</script>
<script setup>
import config from '../../config.js';
import { Latency } from '../../lib/latency.js';
import { OneShotAudioSession, PcmVoiceActivityDetector, VOICE_ACTIVITY_LIMITS } from '../../lib/one-shot-audio.js';
import { pcmToWav } from '../../lib/wav.js';
import { Conversation, createTransport } from '../../lib/gateway.js';
import { TempleControls, LABELS, BUSY_STATES, briefAnswer, errorView } from '../../lib/voice-ui.js';

export default {
  data: { phase: 'THINKING', label: '● Подключаюсь', history: [], errorText: '', hint: '', scroll: 0, scrollTarget: '' },
  onLoad() {
    this.pageEpoch = 0; this.visible = false; this.spokenTurn = null; this.awaitingStop = false; this.trace = [];
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
    this.controls = new TempleControls({ tap: () => this.tap(), exit: () => this.cleanup(),
      scroll: direction => { if (this.data.history.length) this.setData({ scrollTarget: '', scroll: Math.max(0, (this.scrollPosition || 0) + direction * 110) }); },
      trace: entry => {
        // Only key codes/state, never speech, prompts, credentials or answers.
        this.trace.push({ ...entry, phase: this.data.phase, at: Date.now() });
        this.trace = this.trace.slice(-32);
        try { wx.setStorageSync('mac-codex-temple-trace', this.trace); } catch (_) {}
      } });
    if (this.client) this.client.open();
  },
  renderState(value) {
    if (!this.visible) return;
    const history = value.history || this.data.history;
    const latest = history.at(-1);
    const revision = latest ? latest.requestId + ':' + latest.completed + ':' + latest.assistant.length : '';
    const changed = revision !== this.historyRevision;
    this.historyRevision = revision;
    const update = { history, ...(changed && latest ? { scrollTarget: 'exchange-' + latest.requestId } : {}) };
    if (value.state === 'ERROR') { this.setData(update); this.showError(value.detail); return; }
    const phase = value.state;
    this.setData({ ...update, phase, label: LABELS[phase] || LABELS.ERROR, errorText: '',
      hint: phase === 'READY' ? 'Нажмите на дужку и говорите' :
        phase === 'DONE' ? 'Нажмите для следующей реплики' :
        value.pendingApproval ? 'Ожидает подтверждения на Mac' :
        BUSY_STATES.includes(phase) ? (value.detail === 'Останавливаю…' ? value.detail : 'Нажатие — отмена') : '' }, () => {
        if (phase === 'DONE' && this.latency?.sample?.turnId === value.turnId && this.latency.sample.T9 && !this.latency.sample.T10) { this.latency.mark('T10'); this.latency.finish(); }
      });
    const ttsText = phase === 'DONE' && latest?.completed && latest.turnId === value.turnId ? briefAnswer(latest.assistant) : '';
    if (ttsText && value.turnId && this.spokenTurn !== value.turnId) {
      this.spokenTurn = value.turnId;
      this.speak(ttsText);
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
    this.setData({ phase: 'ERROR', label: LABELS.ERROR, errorText: error.title,
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
    if (this.data.phase === 'LISTENING') { this.audio.finishRecording(); return; }
    if (BUSY_STATES.includes(this.data.phase)) {
      if (this.sendTimer || this.audio.phase === 'stopping') { clearTimeout(this.sendTimer); this.sendTimer = null; this.audio.cancel('cancelled', { stopRecorder: false }); this.renderState({state:'READY'}); }
      else this.client.stop();
      return;
    }
    if (this.data.phase === 'ERROR') { this.client.open(); return; }
    if (!['READY', 'DONE'].includes(this.data.phase) || this.awaitingStop || this.client.operation) return;
    if (!this.recorder) { this.showError('microphone_unavailable'); return; }
    this.stopSpeech(); this.latency.sample = null; this.audio.reset(); this.awaitingStop = true;
    this.audio.begin({ requestId: crypto.randomUUID(), stopRecorder: () => {
      if (this.visible) this.setData({ phase: 'TRANSCRIBING', label: LABELS.TRANSCRIBING, errorText: '', hint: 'Нажатие — отмена' });
      this.recorder.stop().catch(() => { this.awaitingStop = false; this.recordingError('recording_failed'); });
    }});
    this.setData({ phase: 'LISTENING', label: LABELS.LISTENING, errorText: '', hint: 'Нажмите, чтобы отправить' });
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
    } catch (_) { if (this.visible && epoch === this.pageEpoch) this.setData({ hint: 'TTS недоступен · Нажмите для следующей реплики' }); }
  },
  stopSpeech() {
    this.pageEpoch++;
    if (this.player) { try { this.player.destroy(); } catch (_) {} this.player = null; }
    if (this.speechTask) { try { this.speechTask.abort(); } catch (_) {} this.speechTask = null; }
  },
  onKeyDown(event) { this.controls?.handle('down', event); },
  onKeyUp(event) { this.controls?.handle('up', event); },
  cleanup() {
    this.visible = false;
    if (this.sendTimer) clearTimeout(this.sendTimer); this.sendTimer = null;
    this.audio?.cancel('hidden'); this.stopSpeech(); this.client?.close();
  },
  onHide() { this.cleanup(); },
  onUnload() { this.cleanup(); }
};
</script>
<page>
  <view class="screen">
    <text class="brand">Mac Codex</text>
    <text class="state">{{label}}</text>
    <text wx:if="{{errorText}}" class="error">{{errorText}}</text>
    <scroll-view class="answer" scroll-y="true" scroll-top="{{scroll}}" scroll-into-view="{{scrollTarget}}" bindscroll="handleScroll">
      <view class="content">
        <view wx:for="{{history}}" wx:key="requestId" id="exchange-{{item.requestId}}" class="exchange">
          <text class="caption">Ты:</text>
          <text class="body">{{item.user}}</text>
          <text wx:if="{{item.completed}}" class="caption">Codex:</text>
          <text wx:if="{{item.completed}}" class="body">{{item.assistant}}</text>
        </view>
      </view>
    </scroll-view>
    <text class="hint">{{hint}}</text>
  </view>
</page>
<style>
.screen { display: flex; flex-direction: column; height: 100vh; box-sizing: border-box; padding: 16px; gap: 10px; background-color: #000000; color: #40ff5e; }
.brand { font-size: 16px; }
.state { font-size: 22px; font-weight: 600; }
.answer { width: 100%; flex-grow: 1; flex-shrink: 1; flex-basis: 0px; }
.content, .exchange { display: flex; flex-direction: column; width: 100%; gap: 12px; }
.exchange { margin-bottom: 20px; }
.error, .body { width: 100%; font-size: 19px; line-height: 1.35; }
.caption { font-size: 13px; color: rgba(64,255,94,0.72); }
.hint { font-size: 16px; color: rgba(64,255,94,0.72); }
</style>
