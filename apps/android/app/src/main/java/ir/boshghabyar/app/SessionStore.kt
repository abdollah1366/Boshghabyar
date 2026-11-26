package ir.boshghabyar.app

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SessionStore(context: Context) {
    private val preferences = EncryptedSharedPreferences.create(
        context,
        "boshghabyar_session",
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    var token: String?
        get() = preferences.getString(KEY, null)
        set(value) {
            preferences.edit().putString(KEY, value).apply()
        }

    fun clear() {
        preferences.edit().remove(KEY).apply()
    }

    private companion object {
        const val KEY = "jwt"
    }
}
