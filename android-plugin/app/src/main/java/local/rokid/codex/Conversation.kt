package local.rokid.codex

import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.Executors

class Conversation(private val store: CredentialStore, private val show: (String, String) -> Unit,
                   private val speak: (String) -> Unit) {
    private val api = GatewayApi(store)
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private var generation = 0
    private var retryMs = 1000L
    var ready = false; private set
    var running = false; private set
    private var snapshot: JSONObject? = null
    private fun uuid() = UUID.randomUUID().toString()

    fun open() {
        generation++; ready = false
        show("Thinking", "Подключаю Mac…")
        launch {
            val health = api.request("GET", "/v1/health")
            check(health.optBoolean("codex") && health.optBoolean("loggedIn"))
            if (store.pending != null) replayPending()
            if (store.conversationId == null) create(null)
            api.request("GET", "/v1/sessions/${store.conversationId}")
        }
    }
    private fun create(project: String?): JSONObject {
        val body = JSONObject().put("requestId", uuid())
        if (project != null) body.put("project", project)
        return sendSaved("/v1/sessions", body)
    }
    private fun sendSaved(route: String, body: JSONObject): JSONObject {
        store.pending = JSONObject().put("route", route).put("body", body).toString()
        return replayPending()
    }
    private fun replayPending(): JSONObject {
        val pending = JSONObject(store.pending ?: error("no_pending_request"))
        val result = api.request("POST", pending.getString("route"), pending.getJSONObject("body"))
        store.conversationId = result.getString("id")
        store.pending = null
        return result
    }
    fun submit(text: String) {
        if (!ready || store.pending != null) { show("Error", "Соединение восстанавливается. Нажми ещё раз."); return }
        val command = CommandPlanner.plan(text)
        if (running && command.action != "stop") { show("Working", "Сначала дождись ответа или скажи «стоп»."); return }
        ready = false
        main.removeCallbacksAndMessages(null)
        show("Thinking", text.take(240))
        launch {
            when (command.action) {
                "stop" -> api.request("POST", "/v1/sessions/${store.conversationId}/stop", JSONObject())
                "new" -> create(null)
                "project" -> create(command.text)
                else -> sendSaved("/v1/sessions/${store.conversationId}/turns", JSONObject().put("requestId", uuid()).put("text", command.text))
            }
        }
    }
    fun transcribe(wav: ByteArray) {
        ready = false
        main.removeCallbacksAndMessages(null)
        val current = generation
        show("Thinking", "Распознаю на Mac…")
        worker.execute {
            val result = runCatching { api.transcribe(wav) }
            wav.fill(0)
            main.post {
                if (current != generation) return@post
                ready = true
                result.onSuccess { submit(it) }.onFailure { show("Error", "STT недоступен. Проверь Whisper на Mac.") }
            }
        }
    }
    fun listening() { generation++; main.removeCallbacksAndMessages(null); show("Listening", "Говорите. Нажмите для отправки.") }
    fun resumeDisplay() { snapshot?.let { render(it) } }
    private fun launch(operation: () -> JSONObject) {
        val current = generation
        worker.execute {
            val result = runCatching(operation)
            main.post {
                if (generation != current) return@post
                result.onSuccess { retryMs = 1000; ready = true; render(it) }.onFailure {
                    ready = false
                    val failure = it as? ApiFailure
                    show("Error", failure?.code ?: "Нет связи с Mac. Восстанавливаю…")
                    if (failure != null && failure.status in listOf(400, 401, 403, 404, 409)) {
                        // An ambiguous persisted request requires local inspection; never silently replace it.
                        return@onFailure
                    }
                    main.postDelayed({
                        if (generation == current) launch {
                            if (store.pending != null) replayPending()
                            else if (store.conversationId != null) api.request("GET", "/v1/sessions/${store.conversationId}")
                            else { val h = api.request("GET", "/v1/health"); check(h.optBoolean("codex")); create(null) }
                        }
                    }, retryMs)
                    retryMs = (retryMs * 2).coerceAtMost(10000)
                }
            }
        }
    }
    private fun render(s: JSONObject) {
        snapshot = s
        val status = s.optString("status", "Error")
        running = status == "Thinking" || status == "Working" || s.optBoolean("uncertain")
        val text = if (s.optBoolean("pendingApproval")) "Ожидает отдельного подтверждения на Mac."
            else s.optString("error").takeUnless { it.isBlank() || it == "null" }
                ?: s.optString("text").ifBlank { s.optString("partial").ifBlank { "Нажми и говори. Проект: ${s.optString("project")}" } }
        show(status, text)
        val turn = s.optString("turnId")
        if (status == "Done" && turn.isNotBlank() && turn != "null" && store.spokenTurn != turn && s.optString("text").isNotBlank()) {
            store.spokenTurn = turn
            speak(s.getString("text").take(600))
        }
        if (running) {
            val current = generation
            main.postDelayed({ if (current == generation) launch { api.request("GET", "/v1/sessions/${store.conversationId}") } }, 1000)
        }
    }
    fun close() { generation++; ready = false; main.removeCallbacksAndMessages(null) }
    fun destroy() { close(); worker.shutdownNow() }
}
