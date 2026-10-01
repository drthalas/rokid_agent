package local.rokid.codex

import org.json.JSONObject
import java.net.URL
import java.security.MessageDigest
import java.security.cert.X509Certificate
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLContext
import javax.net.ssl.X509TrustManager

class GatewayApi(private val store: CredentialStore) {
    fun request(method: String, route: String, body: JSONObject? = null): JSONObject =
        bytes(method, route, body?.toString()?.toByteArray(Charsets.UTF_8), "application/json")

    fun transcribe(wav: ByteArray): String = bytes("POST", "/v1/stt", wav, "audio/wav").getString("text")

    private fun bytes(method: String, route: String, body: ByteArray?, contentType: String): JSONObject {
        val base = URL(store.endpoint)
        require(base.protocol == "https" && base.userInfo == null && base.query == null && base.ref == null)
        require(base.path.isEmpty() || base.path == "/")
        val expected = store.certificatePin.lowercase().replace(":", "")
        require(expected.matches(Regex("[0-9a-f]{64}")))
        fun pinned(cert: X509Certificate): Boolean {
            cert.checkValidity()
            val actual = MessageDigest.getInstance("SHA-256").digest(cert.encoded).joinToString("") { "%02x".format(it.toInt() and 255) }
            return MessageDigest.isEqual(actual.toByteArray(), expected.toByteArray())
        }
        val trust = object : X509TrustManager {
            override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
            override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) { throw java.security.cert.CertificateException() }
            override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {
                if (chain.isEmpty() || !pinned(chain[0])) throw java.security.cert.CertificateException("pin_mismatch")
            }
        }
        val tls = SSLContext.getInstance("TLS").apply { init(null, arrayOf(trust), null) }
        val connection = URL(store.endpoint.trimEnd('/') + route).openConnection() as HttpsURLConnection
        try {
            connection.sslSocketFactory = tls.socketFactory
            // Exact out-of-band leaf certificate identity replaces DNS PKI for the LAN certificate.
            connection.hostnameVerifier = javax.net.ssl.HostnameVerifier { _, session ->
                runCatching { pinned(session.peerCertificates[0] as X509Certificate) }.getOrDefault(false)
            }
            connection.instanceFollowRedirects = false
            connection.requestMethod = method
            connection.connectTimeout = 5000
            connection.readTimeout = if (route == "/v1/stt") 100000 else 35000
            connection.setRequestProperty("Authorization", "Bearer " + (store.readAccessToken() ?: error("not_configured")))
            connection.setRequestProperty("Content-Type", contentType)
            if (body != null) {
                connection.doOutput = true
                connection.setFixedLengthStreamingMode(body.size)
                connection.outputStream.use { it.write(body) }
            }
            val status = connection.responseCode
            val stream = if (status == 200) connection.inputStream else connection.errorStream
            val result = stream?.use { input ->
                val output = java.io.ByteArrayOutputStream()
                val chunk = ByteArray(4096)
                while (true) {
                    val count = input.read(chunk)
                    if (count < 0) break
                    output.write(chunk, 0, count)
                    require(output.size() <= 131072)
                }
                val bytes = output.toByteArray()
                require(bytes.size <= 131072)
                JSONObject(String(bytes, Charsets.UTF_8))
            } ?: JSONObject()
            if (status != 200) throw ApiFailure(status, result.optString("error", "gateway_error"))
            return result
        } finally { connection.disconnect() }
    }
}
class ApiFailure(val status: Int, val code: String) : Exception(code)
