package ir.boshghabyar.app

import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

@Stable
class AppState(val api: ApiClient, val store: SessionStore) {
    var user by mutableStateOf<AppUser?>(null)
    val snackbar = SnackbarHostState()

    fun updateBalance(balance: Int) {
        val current = user ?: return
        user = current.copy(tokenBalance = balance)
    }

    suspend fun refreshUser() {
        runCatching { api.me() }.onSuccess { user = it }
    }

    fun notify(scope: CoroutineScope, message: String) {
        scope.launch {
            snackbar.currentSnackbarData?.dismiss()
            snackbar.showSnackbar(message)
        }
    }
}

suspend fun <T> apiResult(block: suspend () -> T): Result<T> =
    try {
        Result.success(block())
    } catch (e: Exception) {
        Result.failure(e)
    }
