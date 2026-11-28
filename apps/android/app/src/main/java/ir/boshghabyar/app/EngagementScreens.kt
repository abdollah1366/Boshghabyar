package ir.boshghabyar.app

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.json.JSONObject

// ============================ مسابقهٔ روزانه ============================

@Composable
fun QuizScreen(app: AppState) {
    val api = app.api
    val scope = rememberCoroutineScope()
    var question by remember { mutableStateOf<String?>(null) }
    var questionId by remember { mutableStateOf("") }
    var options by remember { mutableStateOf<List<String>>(emptyList()) }
    var selected by remember { mutableIntStateOf(-1) }
    var answered by remember { mutableStateOf(false) }
    var correct by remember { mutableStateOf(false) }
    var explanation by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var alreadyDone by remember { mutableStateOf(false) }

    suspend fun load() {
        apiResult { api.get("/api/quiz/today") }
            .onSuccess { res ->
                val q = res.optJSONObject("question")
                questionId = q?.optString("id").orEmpty()
                question = q?.optString("question")
                val opts = mutableListOf<String>()
                q?.optJSONArray("options")?.let { arr -> for (i in 0 until arr.length()) opts.add(arr.optString(i)) }
                options = opts
                alreadyDone = res.optBoolean("alreadyAnswered")
                correct = res.optBoolean("wasCorrect")
                explanation = res.optString("explanation").takeIf { !res.isNull("explanation") }
            }
            .onFailure { error = ApiClient.message(it) }
    }

    LaunchedEffect(Unit) { load() }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        ScreenHeader("مسابقهٔ روزانه 🎯", "هر روز یک سوال دربارهٔ تغذیه")
        ErrorText(error)
        val q = question
        if (q == null) {
            if (error == null) LoadingText()
        } else if (alreadyDone) {
            AppCard {
                Text(if (correct) "جواب درست بود 🎉" else "اشکال ندارد، فردا دوباره 💪", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                if (explanation != null) Text(explanation!!, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("امروز قبلاً به مسابقه جواب داده‌اید.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            AppCard {
                Text(q, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(12.dp))
                options.forEachIndexed { i, opt ->
                    Surface(
                        onClick = { selected = i },
                        color = if (selected == i) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, if (selected == i) MaterialTheme.colorScheme.primary else AppColors.Border),
                    ) {
                        Text("${('A'.code + i).toChar()}. $opt", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(14.dp))
                    }
                }
                Spacer(Modifier.height(12.dp))
                AppButton("ثبت جواب", enabled = selected >= 0, loading = busy, onClick = {
                    scope.launch {
                        busy = true
                        error = null
                        val result = apiResult {
                            api.post("/api/quiz/answer", JSONObject().put("questionId", questionId).put("answerIndex", selected))
                        }
                        result.onSuccess { res ->
                            answered = true
                            correct = res.optBoolean("correct")
                            explanation = res.optString("explanation")
                            val tokens = res.optInt("tokensEarned", 0)
                            app.notify(scope, if (tokens > 0) "+${faNumber(tokens)} ژتون گرفتید!" else "مشارکت ثبت شد")
                            app.refreshUser()
                        }.onFailure { error = ApiClient.message(it) }
                        busy = false
                    }
                })
            }
            if (answered) {
                AppCard {
                    Text(if (correct) "جواب درست است 🎉" else "جواب درست نبود 💪", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    if (explanation != null) Text(explanation!!, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

// ============================ برترین‌ها ============================

data class LeaderEntry(val rank: Int, val name: String, val points: Int, val level: String)

@Composable
fun LeaderboardScreen(app: AppState) {
    val api = app.api
    var entries by remember { mutableStateOf<List<LeaderEntry>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    val me = app.user?.name

    LaunchedEffect(Unit) {
        apiResult { api.get("/api/leaderboard") }
            .onSuccess { res ->
                val arr = res.optJSONArray("leaderboard")
                val list = mutableListOf<LeaderEntry>()
                arr?.let {
                    for (i in 0 until it.length()) {
                        val e = it.optJSONObject(i)
                        list.add(LeaderEntry(e.optInt("rank"), e.optString("name"), e.optInt("points"), e.optString("level")))
                    }
                }
                entries = list
            }
            .onFailure { error = ApiClient.message(it) }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        ScreenHeader("برترین‌ها 🏆", "کاربرانی که بیشترین ژتون را کسب کرده‌اند")
        ErrorText(error)
        if (entries.isEmpty() && error == null) LoadingText()
        entries.forEach { e ->
            val medal = when (e.rank) {
                1 -> "🥇"; 2 -> "🥈"; 3 -> "🥉"; else -> "#${e.rank}"
            }
            Surface(
                color = if (e.name == me) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, AppColors.Border.copy(alpha = 0.5f)),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(medal, style = MaterialTheme.typography.titleLarge)
                    Column(Modifier.weight(1f)) {
                        Text(e.name + if (e.name == me) " (شما)" else "", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        Text(e.level, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Text("${faNumber(e.points)} ژتون", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = AppColors.Gold)
                }
            }
        }
        if (entries.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            AppCard {
                SectionTitle("چگونه بالا بیایم؟")
                Text("ورود روزانه +۲ · ثبت وعده +۳ · مسابقهٔ درست +۱۰ · معرفی دوست +۵۰ · ثبت بارکد +۵", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
