package ir.boshghabyar.app

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import kotlinx.coroutines.launch
import org.json.JSONObject

@Composable
fun ScanFoodScreen(app: AppState) {
    val api = app.api
    val scope = rememberCoroutineScope()
    var barcode by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var kcal by remember { mutableStateOf("") }
    var servingGrams by remember { mutableStateOf("100") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var success by remember { mutableStateOf<String?>(null) }

    val scanLauncher = rememberLauncherForActivityResult(ScanContract()) { result ->
        val contents = result.contents
        if (!contents.isNullOrBlank()) {
            barcode = toLatin(contents).filter { it.isDigit() }
            error = null
        } else {
            error = "بارکدی خوانده نشد؛ دستی وارد کنید"
        }
    }

    fun scan() {
        val options = ScanOptions().setBeepEnabled(true)
        scanLauncher.launch(options)
    }

    fun submit() {
        val kcalNum = kcal.toIntOrNull() ?: 0
        if (barcode.length < 4) { error = "بارکد را اسکن یا وارد کنید"; return }
        if (name.isBlank()) { error = "نام محصول را وارد کنید"; return }
        if (kcalNum <= 0) { error = "انرژی (کیلوکالری در ۱۰۰ گرم) را وارد کنید"; return }
        scope.launch {
            busy = true
            error = null
            success = null
            val result = apiResult {
                api.post(
                    "/api/foods/scan",
                    JSONObject()
                        .put("barcode", barcode)
                        .put("nameFa", name.trim())
                        .put("kcalPer100g", kcalNum)
                        .put("servingGrams", servingGrams.toIntOrNull() ?: 100)
                        .put("servingLabel", "سهم"),
                )
            }
            result.onSuccess { res ->
                val tokens = res.optInt("tokensEarned", 0)
                success = if (res.optBoolean("alreadyExists")) {
                    "این محصول قبلاً ثبت شده است و به فهرست غذاها اضافه شد."
                } else {
                    "محصول ثبت شد و به فهرست غذاها اضافه شد" + if (tokens > 0) " · +${faNumber(tokens)} ژتون" else ""
                }
                barcode = ""
                name = ""
                kcal = ""
                app.refreshUser()
            }.onFailure { error = ApiClient.message(it) }
            busy = false
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        ScreenHeader("افزودن محصول با بارکد", "محصول را اسکن کنید و انرژی آن را از روی بسته وارد کنید")

        AppCard {
            SectionTitle("اسکن بارکد", "با دوربین، بارکد خودکار خوانده می‌شود")
            AppButton("اسکن با دوربین", ::scan)
            if (barcode.isNotBlank()) {
                Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                    Text("بارکد: ${faDigits(barcode)}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.padding(12.dp))
                }
            }
        }

        AppCard {
            SectionTitle("اطلاعات محصول")
            PersianField("بارکد", barcode, { barcode = toLatin(it).filter { c -> c.isDigit() } }, placeholder = "۱۳ رقم", numeric = true)
            PersianField("نام محصول", name, { name = it }, placeholder = "مثلاً بیسکویت کاکائویی")
            PersianField("انرژی (کیلوکالری در ۱۰۰ گرم)", kcal, { kcal = toLatin(it).filter { c -> c.isDigit() } }, numeric = true)
            PersianField("وزن هر سهم (گرم)", servingGrams, { servingGrams = it }, numeric = true)
            Text("انرژی را از جدول ارزش غذایی پشت بسته بخوانید.", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            ErrorText(error)
            if (!success.isNullOrBlank()) {
                Text(success!!, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(vertical = 6.dp))
            }
            AppButton("ثبت محصول (+${faNumber(5)} ژتون)", ::submit, loading = busy)
        }

        AppCard {
            SectionTitle("چرا این کار ارزش دارد؟")
            Text("محصولی که ثبت کنید، در فهرست غذاهای همهٔ کاربران قرار می‌گیرد و برای وعده‌های بعدی خودتان هم در دسترس است. با ثبت هر محصول جدید ۵ ژتون می‌گیرید.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
