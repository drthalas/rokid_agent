package local.rokid.codex

import android.app.Activity
import android.os.Bundle
import android.text.InputType
import android.view.WindowManager
import android.widget.*
import java.net.URL

class SettingsActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        val store = CredentialStore(this)
        // Debug ADB setup writes only through run-as into this app's private directory.
        val provision = java.io.File(filesDir, "provision.json")
        if (provision.exists()) {
            try {
                require(provision.length() < 8192)
                val data = org.json.JSONObject(provision.readText())
                val url = URL(data.getString("endpoint"))
                val hash = data.getString("pin")
                val secret = data.getString("token")
                require(url.protocol == "https" && url.userInfo == null && url.query == null && url.ref == null && (url.path.isEmpty() || url.path == "/"))
                require(hash.matches(Regex("[0-9a-f]{64}")) && secret.matches(Regex("[A-Za-z0-9_-]{43,}")))
                store.endpoint = url.toString(); store.certificatePin = hash; store.saveAccessToken(secret)
                store.conversationId = null; store.pending = null
                provision.delete(); finish(); return
            } catch (_: Exception) { provision.delete() }
        }
        val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(20, 20, 20, 20) }
        fun field(hintText: String, current: String = "", secret: Boolean = false) = EditText(this).apply {
            hint = hintText; setText(current); isSingleLine = true
            inputType = InputType.TYPE_CLASS_TEXT or if (secret) InputType.TYPE_TEXT_VARIATION_PASSWORD else InputType.TYPE_TEXT_VARIATION_URI
            importantForAutofill = android.view.View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
            layout.addView(this)
        }
        layout.addView(TextView(this).apply { text = "Mac Codex • защищённое подключение" })
        val endpoint = field("https://192.168.1.10:8443", store.endpoint)
        val pin = field("SHA-256 сертификата", store.certificatePin)
        val token = field("Device token (пусто — сохранить)", secret = true)
        val message = TextView(this)
        layout.addView(Button(this).apply {
            text = "Сохранить"
            setOnClickListener {
                runCatching {
                    val url = URL(endpoint.text.toString().trim())
                    require(url.protocol == "https" && url.userInfo == null && url.query == null && url.ref == null && (url.path.isEmpty() || url.path == "/"))
                    val hash = pin.text.toString().trim().lowercase().replace(":", "")
                    require(hash.matches(Regex("[0-9a-f]{64}")))
                    val value = token.text.toString().trim()
                    require(value.length >= 43 || (value.isEmpty() && store.readAccessToken() != null))
                    if (store.endpoint != url.toString() || store.certificatePin != hash) {
                        store.conversationId = null; store.pending = null
                    }
                    store.endpoint = url.toString(); store.certificatePin = hash
                    if (value.isNotEmpty()) store.saveAccessToken(value)
                    token.setText(""); finish()
                }.onFailure { message.text = "Проверь HTTPS адрес, fingerprint и токен." }
            }
        })
        layout.addView(Button(this).apply {
            text = "Сбросить локальную привязку диалога"
            setOnClickListener {
                android.app.AlertDialog.Builder(this@SettingsActivity).setMessage("Сначала проверь задачу на Mac: сброс не останавливает её.")
                    .setPositiveButton("Сбросить") { _, _ -> store.pending = null; store.conversationId = null; message.text = "Диалог отвязан локально." }
                    .setNegativeButton("Отмена", null).show()
            }
        })
        layout.addView(message)
        setContentView(ScrollView(this).apply { addView(layout) })
    }
}
