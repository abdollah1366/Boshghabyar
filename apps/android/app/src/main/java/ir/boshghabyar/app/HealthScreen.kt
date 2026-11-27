package ir.boshghabyar.app

import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
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
import java.util.Calendar

@Composable
fun HealthScreen(app: AppState) {
    val api = app.api
    val scope = rememberCoroutineScope()
    var selectedType by remember { mutableStateOf("blood_sugar") }
    var value by remember { mutableStateOf("") }
    var history by remember { mutableStateOf<List<HealthMeasurement>>(emptyList()) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var success by remember { mutableStateOf<String?>(null) }

    suspend fun load() {
        apiResult {
            HealthMeasurement.list(api.get("/api/health/measurements?type=$selectedType&limit=50").optJSONArray("measurements"))
        }.onSuccess { history = it }
            .onFailure { error = ApiClient.message(it) }
    }

    LaunchedEffect(selectedType) { load() }

    val unit = when (selectedType) {
        "blood_sugar" -> "mg/dL"; "hba1c" -> "%"; "weight" -> "kg"; "height" -> "cm"
        "systolic_bp", "diastolic_bp" -> "mmHg"; "heart_rate" -> "bpm"; "cholesterol" -> "mg/dL"; "sleep_hours" -> "h"
        else -> ""
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        ScreenHeader("شاخص‌های سلامتی", "قند، وزن، فشار خون، HbA1c و سایر تست‌ها")

        AppCard {
            SectionTitle("ثبت جدید")
            Row(Modifier.horizontalScroll(rememberScrollState())) {
                HEALTH_TYPE_LABELS.forEach { (type, label) ->
                    FilterChip(selected = selectedType == type, onClick = { selectedType = type }, label = { Text(label) }, modifier = Modifier.padding(end = 6.dp))
                }
            }
            PersianField("مقدار ($unit)", value, { value = it }, numeric = true)
            ErrorText(error)
            if (!success.isNullOrBlank()) Text(success!!, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
            AppButton("ثبت شاخص (+${faNumber(2)} ژتون)", {
                scope.launch {
                    busy = true
                    error = null
                    success = null
                    val v = value.toDoubleOrNull()
                    if (v == null || v <= 0) { error = "مقدار معتبر وارد کنید"; busy = false; return@launch }
                    val result = apiResult {
                        api.post("/api/health/measurements", JSONObject().put("type", selectedType).put("value", v).put("unit", unit))
                    }
                    result.onSuccess { res ->
                        success = "ثبت شد · ${faNumber(v)} $unit" + if (res.optInt("tokensEarned", 0) > 0) " · +${faNumber(res.optInt("tokensEarned"))} ژتون" else ""
                        value = ""
                    }.onFailure { error = ApiClient.message(it) }
                    if (result.isSuccess) {
                        app.refreshUser()
                        load()
                    }
                    busy = false
                }
            }, loading = busy)
        }

        AppCard {
            SectionTitle("روند ${HEALTH_TYPE_LABELS[selectedType] ?: selectedType}")
            if (history.isEmpty()) {
                EmptyState(Icons.Filled.Favorite, "هنوز شاخصی ثبت نشده", "شاخص‌های سلامتی خود را به‌صورت منظم ثبت کنید تا روند را ببینید.")
            } else {
                val sorted = history.sortedBy { it.measuredAt }
                BarChart(values = sorted.map { it.value.toInt() }, labels = sorted.map { it.measuredAt.takeLast(5) })
                Spacer(Modifier.height(8.dp))
                val latest = history.first()
                Text("آخرین مقدار: ${faNumber(latest.value)} $unit (${jalaliDate(latest.measuredAt)})", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                Text("میانگین: ${faNumber(sorted.map { it.value }.average().toInt())} · کمترین: ${faNumber(sorted.minOf { it.value }.toInt())} · بیشترین: ${faNumber(sorted.maxOf { it.value }.toInt())}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        AppCard {
            SectionTitle("تاریخچه")
            if (history.isEmpty()) {
                EmptyText("رکوردی وجود ندارد.")
            } else {
                history.take(20).forEach { m ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("${faNumber(m.value)} ${m.unit}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                            Text(jalaliDate(m.measuredAt), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        TextButton(onClick = {
                            scope.launch {
                                apiResult { api.delete("/api/health/measurements/${m.id}") }
                                    .onSuccess { load() }
                                    .onFailure { error = ApiClient.message(it) }
                            }
                        }) { Text("حذف", color = MaterialTheme.colorScheme.error) }
                    }
                    HorizontalDivider(color = AppColors.Border.copy(alpha = 0.4f))
                }
            }
        }

        AppCard {
            SectionTitle("پاداش‌ها")
            Text("ثبت هر شاخص +۲ ژتون · ۷ روز پیاپی ثبت +۱۰ ژتون · رسیدن به هدف سلامتی +۵۰ ژتون.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
