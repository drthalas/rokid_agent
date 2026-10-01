<script def>
{
  "navigationBarTitleText": "Mac Codex",
  "description": "Open the Mac Codex voice terminal in READY state. The user taps the temple to dictate a task. Opening the agent is not a task.",
  "schema": {"data": {"type": "object", "properties": {}}}
}
</script>
<script setup>
import config from '../../config.js';
import { OneShotAudioSession, PcmVoiceActivityDetector, VOICE_ACTIVITY_LIMITS } from '../../lib/one-shot-audio.js';
import { pcmToWav } from '../../lib/wav.js';
import { Conversation, createTransport } from '../../lib/gateway.js';
import { TempleControls, LABELS, BUSY_STATES, briefAnswer, errorView } from '../../lib/voice-ui.js';

export default {
  data: { phase: 'THINKING', label: '● Подключаюсь', summary: '', fullText: '', longAnswer: false, hint: '', scroll: 0 },
  onLoad() {
    this.pageEpoch = 0; this.visible = false; this.spokenTurn = null; this.awaitingStop = false; this.trace = [];
    this.audio = new OneShotAudioSession({
      limits: { sampleRate: 16000, channels: 1, bytesPerSample: 2, maxDurationMs: 30000, maxBytes: 960000 },
      voiceDetector: new PcmVoiceActivityDetector({ limits: { ...VOICE_ACTIVITY_LIMITS, automaticStopOnSilence: false } })
    });
    try {
      this.client = new Conversation({ config, transport: createTransport(wx, config),
        storage: { get: key => wx.getStorageSync(key), set: (key, value) => wx.setStorageSync(key, value) },
        id: () => crypto.randomUUID(), render: value => this.renderState(value) });
      this.recorder = wx.media.getRecorderManager();
      if (this.recorder) this.bindRecorder();
    } catch (_) { this.showError('connection_not_configured'); }
  },
  onShow() {
    this.visible = true;
    this.controls = new TempleControls({ tap: () => this.tap(), exit: () => this.cleanup(),
      scroll: direction => { if (this.data.phase === 'DONE') this.setData({ scroll: Math.max(0, this.data.scroll + direction * 110) }); },
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
    if (value.state === 'ERROR') { this.showError(value.detail); return; }
    const phase = value.state;
    const text = phase === 'DONE' ? String(value.text || '').slice(0, 16000) : '';
    const summary = phase === 'DONE' ? briefAnswer(text) : '';
    this.setData({ phase, label: LABELS[phase] || LABELS.ERROR, summary,
      fullText: text, longAnswer: text.length > 320, scroll: 0,
      hint: phase === 'READY' ? 'Нажмите на дужку и говорите' :
        phase === 'DONE' ? 'Нажмите для следующей реплики' :
        value.pendingApproval ? 'Ожидает подтверждения на Mac' :
        BUSY_STATES.includes(phase) ? (value.detail === 'Останавливаю…' ? value.detail : 'Нажатие — отмена') : '' });
    if (phase === 'DONE' && summary && value.turnId && this.spokenTurn !== value.turnId) {
      this.spokenTurn = value.turnId;
      this.speak(summary);
    }
  },
  showError(reason) {
    const error = errorView(reason);
    this.setData({ phase: 'ERROR', label: LABELS.ERROR, summary: error.title, fullText: '', longAnswer: false,
      hint: error.reason || 'Нажмите, чтобы подключиться', scroll: 0 });
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
    this.stopSpeech(); this.audio.reset(); this.awaitingStop = true;
    this.audio.begin({ requestId: crypto.randomUUID(), stopRecorder: () => {
      if (this.visible) this.setData({ phase: 'TRANSCRIBING', label: LABELS.TRANSCRIBING, summary: '', hint: 'Нажатие — отмена' });
      this.recorder.stop().catch(() => { this.awaitingStop = false; this.recordingError('recording_failed'); });
    }});
    this.setData({ phase: 'LISTENING', label: LABELS.LISTENING, summary: '', fullText: '', longAnswer: false, scroll: 0, hint: 'Нажмите, чтобы отправить' });
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
    <scroll-view class="answer" scroll-y="true" scroll-top="{{scroll}}">
      <view class="content">
        <text class="summary">{{summary}}</text>
        <view wx:if="{{longAnswer}}" class="full"><text class="caption">Полный ответ</text><text class="body">{{fullText}}</text></view>
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
.content, .full { display: flex; flex-direction: column; width: 100%; gap: 12px; }
.full { margin-top: 24px; }
.summary, .body { width: 100%; font-size: 19px; line-height: 1.35; }
.caption { font-size: 13px; color: rgba(64,255,94,0.72); }
.hint { font-size: 16px; color: rgba(64,255,94,0.72); }
</style>
