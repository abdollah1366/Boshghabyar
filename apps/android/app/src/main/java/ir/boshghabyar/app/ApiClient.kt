package ir.boshghabyar.app

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class ApiException(message: String, val status: Int) : Exception(message)

class ApiClient {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val trackingScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    var token: String? = null

    /** وقتی سرور 401 بدهد فراخوانی می‌شود (نشست پایان یافته) */
    var onUnauthorized: (() -> Unit)? = null

    suspend fun call(method: String, path: String, body: JSONObject? = null): JSONObject =
        withContext(Dispatchers.IO) {
            val builder = Request.Builder().url(BuildConfig.API_BASE_URL + path)
            token?.let { builder.header("Authorization", "Bearer $it") }
            when (method) {
                "GET" -> builder.get()
                "DELETE" -> builder.delete((body?.toString() ?: "{}").toRequestBody(jsonType))
                else -> builder.method(
                    method,
                    (body?.toString() ?: "{}").toRequestBody(jsonType),
                )
            }
            execute(builder.build())
        }

    /** ارسال بایت خام (برای تشخیص تصویر) */
    suspend fun postBytes(path: String, bytes: ByteArray, contentType: String): JSONObject =
        withContext(Dispatchers.IO) {
            val builder = Request.Builder()
                .url(BuildConfig.API_BASE_URL + path)
                .post(bytes.toRequestBody(contentType.toMediaType()))
            token?.let { builder.header("Authorization", "Bearer $it") }
            execute(builder.build())
        }

    private suspend fun execute(request: Request): JSONObject {
        val response = client.newCall(request).execute()
        val text = response.body?.string().orEmpty()
        if (response.code == 401) {
            token = null
            onUnauthorized?.invoke()
        }
        if (!response.isSuccessful) {
            val message = runCatching { JSONObject(text).optString("error") }
                .getOrNull()?.takeIf { it.isNotBlank() }
                ?: "خطا در ارتباط با سرور"
            throw ApiException(message, response.code)
        }
        return if (text.isBlank()) JSONObject() else JSONObject(text)
    }

    suspend fun get(path: String) = call("GET", path)

    suspend fun post(path: String, body: JSONObject = JSONObject()) = call("POST", path, body)

    suspend fun patch(path: String, body: JSONObject) = call("PATCH", path, body)

    suspend fun delete(path: String, body: JSONObject = JSONObject()) = call("DELETE", path, body)

    suspend fun me(): AppUser = AppUser.from(get("/api/me").optJSONObject("user")!!)

    suspend fun auth(path: String, body: JSONObject): Pair<String, AppUser> {
        val response = post(path, body)
        return response.getString("token") to AppUser.from(response.getJSONObject("user"))
    }

    fun track(type: String, payload: JSONObject = JSONObject()) {
        if (token == null) return
        trackingScope.launch {
            runCatching {
                call(
                    "POST",
                    "/api/events",
                    JSONObject().put("type", type).put("payload", payload),
                )
            }
        }
    }

    companion object {
        fun message(error: Throwable): String = when (error) {
            is ApiException -> error.message ?: "خطا در ارتباط با سرور"
            else -> "خطا در ارتباط با سرور"
        }
    }
}
