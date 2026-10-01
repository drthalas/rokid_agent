// Voice lifecycle adapted from rokidhub-codex, MIT, Copyright (c) 2026 Azat Akhmetshin.
package local.rokid.codex

import android.view.KeyEvent
import com.anezium.rokidbus.client.plugin.*
import com.anezium.rokidbus.shared.plugin.NexusInputEvent

class VoicePluginService : NexusPluginService() {
    private lateinit var conversation: Conversation
    private var surface: NexusSurfaceSession? = null
    private var speech: NexusSpeechSession? = null
    private var tts: NexusTtsSession? = null
    private var shown = false
    private var generation = 0
    private var title = "Done"
    private var lines = listOf("")
    private var page = 0
    override fun onCreate() {
        super.onCreate()
        conversation = Conversation(CredentialStore(this), { state, text ->
            title = state; lines = text.chunked(220).ifEmpty { listOf("") }; page = 0; render()
        }, { text ->
            val session = tts ?: nexusTtsSession(object : NexusTtsCallbacks {
                override fun onTtsStarted(utteranceId: String) = Unit
                override fun onTtsDone(utteranceId: String, reason: NexusTtsDoneReason) = Unit
            })?.also { tts = it }
            session?.speak(text)
        })
    }
    override fun onNexusOpen() {
        generation++; shown = false; speech?.stop(); speech = null
        surface = nexusSurfaceSession("main"); conversation.open()
    }
    private fun render() {
        val card = NexusCard(title = title, lines = lines.drop(page * 3).take(3), footer = "Tap: voice • Swipe: answer • Back: close", contentKey = "voice-$title-${lines.hashCode()}-$page", handlesBack = true)
        val result = if (shown) surface?.updateCard(card) else surface?.showCard(card)
        if (result == NexusSdkResult.SENT) shown = true
    }
    override fun onNexusInput(event: NexusInputEvent) {
        if (event.action != KeyEvent.ACTION_DOWN) return
        when (event.keyCode) {
            KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_DPAD_CENTER -> if (speech == null) listen()
            KeyEvent.KEYCODE_BACK -> surface?.hide()
            KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.KEYCODE_DPAD_DOWN -> { page = (page + 1).coerceAtMost((lines.size - 1) / 3); render() }
            KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_DPAD_UP -> { page = (page - 1).coerceAtLeast(0); render() }
        }
    }
    private fun listen() {
        if (!conversation.ready) { conversation.open(); return }
        tts?.close(); tts = null
        conversation.listening()
        val current = generation
        var submitted = false
        val session = nexusSpeechSession(object : NexusSpeechCallbacks {
            override fun onSpeechStarted(realtime: Boolean) = Unit
            override fun onSpeechState(state: NexusSpeechState) = Unit
            override fun onSpeechPartial(text: String) {
                if (current != generation || submitted) return
                title = "Listening"; lines = listOf(text.take(220)); render()
            }
            override fun onSpeechFinal(text: String) {
                if (current != generation || submitted || text.isBlank()) return
                submitted = true; speech = null; conversation.submit(text)
            }
            override fun onSpeechStopped(reason: NexusSpeechStopReason, error: NexusSpeechError?) {
                if (current != generation) return
                speech = null
                if (!submitted) { title = "Error"; lines = listOf("STT: ${reason.name}. Tap to retry."); render() }
            }
        })
        speech = session
        if (session?.start("ru-RU") != NexusSdkResult.SENT) {
            speech = null; title = "Error"; lines = listOf("Enable STT capability and speech provider in Nexus."); render()
        }
    }
    override fun onNexusClose() {
        generation++; conversation.close(); speech?.stop(); speech = null
        tts?.close(); tts = null; surface = null; shown = false
    }
    override fun onDestroy() { conversation.destroy(); super.onDestroy() }
}
