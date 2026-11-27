package ir.boshghabyar.app

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.File

@Composable
fun ScanFoodScreen(app: AppState) {
    val api = app.api
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var barcode by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var kcal by remember { mutableStateOf("") }
    var servingGrams by remember { mutableStateOf("100") }
    var busy by remember { mutableStateOf(false) }
    var scanning by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var success by remember { mutableStateOf<String?>(null) }

    val photoUri = remember { mutableStateOf<Uri?>(null) }

    fun decodeBarcode(uri: Uri) {
        scanning = true
        error = null
        val scanner = BarcodeScanning.getClient()
        val image = try {
            InputImage.fromFilePath(context, uri)
        } catch (e: Exception) {
            scanning = false
            error = "تصویر خوانده نشد؛ دوباره تلاش کنید"
            return
        }
        scanner.process(image)
            .addOnSuccessListener { barcodes ->
                scanning = false
                val value = barcodes.firstOrNull()?.rawValue
                if (value != null) {
                    barcode = value
                    error = null
                } else {
                    error = "بارکدی پیدا نشد؛ دوباره عکس بگیرید یا دستی وارد کنید"
                }
            }
            .addOnFailureListener {
                scanning = false
                error = "خواندن بارکد ناموفق بود؛ دستی وارد کنید"
            }
    }

    val takePicture = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
        if (saved) photoUri.value?.let { decodeBarcode(it) }
    }

    fun capturePhoto() {
        val dir = File(context.cacheDir, "camera").apply { mkdirs() }
        val file = File(dir, "barcode_${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        photoUri.value = uri
        takePicture.launch(uri)
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
            apiResult {
                api.post(
                    "/api/foods/scan",
                    JSONObject()
                        .put("barcode", barcode)
                        .put("nameFa", name.trim())
                        .put("kcalPer100g", kcalNum)
                        .put("servingGrams", servingGrams.toIntOrNull() ?: 100)
                        .put("servingLabel", "سهم"),
                )
            }.onSuccess { res ->
                val tokens = res.optInt("tokensEarned", 0)
                success = if (res.optBoolean("alreadyExists")) {
                    "این محصول قبلاً ثبت شده است و به فهرست غذاها اضافه شد."
                } else {
                    "محصول ثبت شد و به فهرست غذاها اضافه شد" + if (tokens > 0) " · +${faNumber(tokens)} ژتون" else ""
                }
                app.refreshUser()
                barcode = ""
                name = ""
                kcal = ""
            }.onFailure { error = ApiClient.message(it) }
            busy = false
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        ScreenHeader("افزودن محصول با بارکد", "محصول را اسکن کنید و انرژی آن را از روی بسته وارد کنید")

        AppCard {
            SectionTitle("اسکن بارکد", "عکس بگیرید تا بارکد خودکار خوانده شود")
            AppButton("اسکن با دوربین", ::capturePhoto, loading = scanning)
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
