// Adapted from rokidhub-codex, Copyright (c) 2026 Azat Akhmetshin. MIT; see licenses/.
package local.rokid.codex

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class CredentialStore(context: Context) {
    private val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

    var endpoint: String
        get() = preferences.getString("endpoint", "")!!
        set(value) { check(preferences.edit().putString("endpoint", value).commit()) }
    var certificatePin: String
        get() = preferences.getString("pin", "")!!
        set(value) { check(preferences.edit().putString("pin", value).commit()) }
    var pending: String?
        get() = preferences.getString("pending", null)
        set(value) { check(preferences.edit().putString("pending", value).commit()) }
    var spokenTurn: String?
        get() = preferences.getString("spoken_turn", null)
        set(value) { check(preferences.edit().putString("spoken_turn", value).commit()) }

    val installationId: String
        get() = preferences.getString(INSTALLATION_ID, null) ?: UUID.randomUUID().toString().also {
            preferences.edit().putString(INSTALLATION_ID, it).apply()
        }

    var conversationId: String?
        get() = preferences.getString(CONVERSATION_ID, null)
        set(value) { check(preferences.edit().apply {
            if (value == null) remove(CONVERSATION_ID) else putString(CONVERSATION_ID, value)
        }.commit()) }

    var projectName: String?
        get() = preferences.getString(PROJECT_NAME, null)
        set(value) { check(preferences.edit().apply {
            if (value == null) remove(PROJECT_NAME) else putString(PROJECT_NAME, value)
        }.commit()) }

    fun readAccessToken(): String? {
        val packed = preferences.getString(ACCESS_TOKEN, null) ?: return null
        return runCatching {
            val encrypted = Base64.decode(packed, Base64.NO_WRAP)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, encrypted.copyOfRange(0, IV_BYTES)))
            cipher.doFinal(encrypted.copyOfRange(IV_BYTES, encrypted.size)).toString(Charsets.UTF_8)
        }.getOrNull()?.takeIf(String::isNotBlank)
    }

    fun saveAccessToken(token: String) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val encrypted = cipher.iv + cipher.doFinal(token.toByteArray(Charsets.UTF_8))
        check(preferences.edit().putString(ACCESS_TOKEN, Base64.encodeToString(encrypted, Base64.NO_WRAP)).commit())
    }

    fun clearAccessToken() = preferences.edit()
        .remove(ACCESS_TOKEN)
        .remove(CONVERSATION_ID)
        .remove(PROJECT_NAME)
        .apply()

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
            init(
                KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .build(),
            )
            generateKey()
        }
    }

    private companion object {
        const val PREFERENCES = "rokid_mac_credentials"
        const val INSTALLATION_ID = "installation_id"
        const val ACCESS_TOKEN = "access_token_encrypted"
        const val CONVERSATION_ID = "conversation_id"
        const val PROJECT_NAME = "project_name"
        const val KEY_ALIAS = "rokid_mac_token_v1"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_BYTES = 12
    }
}
