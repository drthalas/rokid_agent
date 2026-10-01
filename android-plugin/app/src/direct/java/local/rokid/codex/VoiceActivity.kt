package local.rokid.codex

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.view.KeyEvent
import android.view.WindowManager
import android.widget.*
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.Locale
import java.util.concurrent.Executors

/** Direct RV101 terminal; no Nexus phone hub or iPhone app required. */
class VoiceActivity : Activity() {
    private lateinit var conversation: Conversation
    private lateinit var status: TextView
    private lateinit var answer: TextView
    private lateinit var scroll: ScrollView
    private val audioWorker = Executors.newSingleThreadExecutor()
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    @Volatile private var recording = false
    @Volatile private var captureActive = false
    @Volatile private var generation = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(16, 8, 16, 8); setBackgroundColor(Color.BLACK) }
        status = TextView(this).apply { textSize = 24f; setTextColor(Color.GREEN) }
        answer = TextView(this).apply { textSize = 20f; setTextColor(Color.GREEN) }
        scroll = ScrollView(this).apply { addView(answer) }
        root.addView(status)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        val controls = LinearLayout(this)
        controls.addView(Button(this).apply { text = "Говорить / отправить"; setOnClickListener { tap() } })
        controls.addView(Button(this).apply { text = "Настройки"; setOnClickListener { settings() } })
        root.addView(controls); setContentView(root)
        conversation = Conversation(CredentialStore(this), { state, text -> status.text = state; answer.text = text }, { text ->
            if (ttsReady) tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "codex-response")
        })
        tts = TextToSpeech(this) { code ->
            ttsReady = code == TextToSpeech.SUCCESS
            if (ttsReady) tts?.language = Locale.forLanguageTag("ru-RU")
        }
    }
    override fun onResume() { super.onResume(); if (CredentialStore(this).readAccessToken() == null) settings() else conversation.open() }
    private fun settings() { startActivity(Intent(this, SettingsActivity::class.java)) }
    private fun tap() {
        if (captureActive) { recording = false; return }
        if (!conversation.ready) { conversation.open(); return }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 1); return
        }
        tts?.stop(); conversation.listening()
        recording = true; captureActive = true
        val current = generation
        audioWorker.execute {
            var recorder: AudioRecord? = null
            val result = runCatching {
                val size = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
                check(size > 0)
                recorder = AudioRecord(MediaRecorder.AudioSource.MIC, 16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, size.coerceAtLeast(6400))
                check(recorder!!.state == AudioRecord.STATE_INITIALIZED)
                val out = ByteArrayOutputStream()
                val buffer = ByteArray(640)
                recorder!!.startRecording()
                // Bounded one-shot PCM pattern from rokid-personal-ai; manual end or 30 s cap.
                while (recording && current == generation && out.size() < 960000) {
                    val count = recorder!!.read(buffer, 0, buffer.size)
                    check(count > 0 && count % 2 == 0)
                    out.write(buffer, 0, count)
                }
                check(out.size() > 3200)
                val pcm = out.toByteArray()
                val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
                    .put("RIFF".toByteArray()).putInt(pcm.size + 36).put("WAVEfmt ".toByteArray()).putInt(16)
                    .putShort(1).putShort(1).putInt(16000).putInt(32000).putShort(2).putShort(16)
                    .put("data".toByteArray()).putInt(pcm.size).array()
                header + pcm
            }
            runCatching { recorder?.stop() }; recorder?.release()
            captureActive = false; recording = false
            runOnUiThread {
                if (current == generation) result.onSuccess { conversation.transcribe(it) }.onFailure {
                    status.text = "Error"; answer.text = "Не удалось записать голос. Проверь разрешение микрофона."
                    conversation.resumeDisplay()
                }
            }
        }
    }
    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean = when (keyCode) {
        KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> { if (event.repeatCount == 0) tap(); true }
        KeyEvent.KEYCODE_DPAD_DOWN, KeyEvent.KEYCODE_DPAD_RIGHT -> { scroll.smoothScrollBy(0, 120); true }
        KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_DPAD_LEFT -> { scroll.smoothScrollBy(0, -120); true }
        KeyEvent.KEYCODE_MENU -> { settings(); true }
        else -> super.onKeyDown(keyCode, event)
    }
    override fun onPause() { generation++; recording = false; conversation.close(); tts?.stop(); super.onPause() }
    override fun onDestroy() { conversation.destroy(); audioWorker.shutdownNow(); tts?.shutdown(); super.onDestroy() }
}
