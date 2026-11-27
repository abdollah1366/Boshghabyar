package ir.boshghabyar.app

import androidx.compose.foundation.background
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
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject

private data class ReferralBanner(val code: String)

@Composable
fun LoginScreen(app: AppState, onAuthenticated: (AppUser, Boolean) -> Unit) {
    val api = app.api
    val store = app.store
    val scope = rememberCoroutineScope()

    var step by remember { mutableStateOf("phone") }
    var phone by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var referral by remember { mutableStateOf("") }
    var consent by remember { mutableStateOf(false) }
    var showReferral by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var devCode by remember { mutableStateOf<String?>(null) }
    var resendIn by remember { mutableIntStateOf(0) }

    LaunchedEffect(resendIn) {
        if (resendIn > 0) {
            delay(1000)
            resendIn -= 1
        }
    }

    fun requestCode() {
        val normalized = normalizePhone(phone)
        if (normalized.length < 10) {
            error = "شمارهٔ موبایل معتبر نیست"
            return
        }
        scope.launch {
            busy = true
            error = null
            apiResult { api.post("/api/auth/otp/request", JSONObject().put("phone", normalized)) }
                .onSuccess { res ->
                    step = "code"
                    code = ""
                    devCode = res.str("devCode")
                    resendIn = res.optInt("resendInSec", 60)
                }
                .onFailure { e ->
                    val retry = if (e is ApiException && e.status == 429) {
                        val seconds = runCatching { JSONObject(e.message ?: "").optInt("retryAfterSec") }.getOrNull()
                        seconds
                    } else null
                    error = ApiClient.message(e)
                    if (retry != null && retry > 0) resendIn = retry
                }
            busy = false
        }
    }

    fun verify() {
        if (code.length < 4) {
            error = "کد ۴ رقمی را کامل وارد کنید"
            return
        }
        scope.launch {
            busy = true
            error = null
            val body = JSONObject()
                .put("phone", normalizePhone(phone))
                .put("code", code)
            if (name.isNotBlank()) body.put("name", name.trim())
            if (referral.isNotBlank()) body.put("referralCode", referral.trim())
            body.put("researchConsent", consent)
            apiResult { api.auth("/api/auth/otp/verify", body) }
                .onSuccess { (token, user) ->
                    api.token = token
                    store.token = token
                    onAuthenticated(user, true)
                }
                .onFailure { error = ApiClient.message(it) }
            busy = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(24.dp))
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.primaryContainer,
        ) {
            Icon(
                Icons.Filled.Restaurant,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(20.dp).size(44.dp),
            )
        }
        Spacer(Modifier.height(16.dp))
        Text("بشقاب‌یار", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
        Text(
            "همراه هوشمند وعده‌های ایرانی",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            "وعده را ثبت کنید، کالری و هزینه را ببینید و جایگزین متعادل‌تر پیدا کنید.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 6.dp),
        )
        Spacer(Modifier.height(24.dp))

        AppCard {
            if (step == "phone") {
                SectionTitle("ورود با شمارهٔ موبایل", "بدون نیاز به رمز عبور")
                PersianField("شمارهٔ موبایل", phone, { phone = it }, placeholder = "۰۹۱۲۳۴۵۶۷۸۹", phone = true)

                TextButton(onClick = { showReferral = !showReferral }) {
                    Text(if (showReferral) "بستن تنظیمات" else "نام و کد معرف دارید؟")
                }
                if (showReferral) {
                    PersianField("نام (اختیاری)", name, { name = it }, placeholder = "نام شما")
                    PersianField("کد معرف (اختیاری)", referral, { referral = it }, placeholder = "مثلاً AB12CDE")
                }
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Checkbox(checked = consent, onCheckedChange = { consent = it })
                    Text(
                        "مشارکت در پژوهش با داده‌های ناشناس (+۱۰ ژتون هدیه)",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                ErrorText(error)
                AppButton("دریافت کد ورود", ::requestCode, loading = busy)
            } else {
                SectionTitle("کد تأیید", "کد ۴ رقمی را وارد کنید")
                Text(
                    "کد به شمارهٔ ${faDigits(normalizePhone(phone))} ارسال شد.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 8.dp),
                )
                PersianField("کد ۴ رقمی", code, { code = toLatin(it).filter { c -> c.isDigit() }.take(4) }, numeric = true)

                if (devCode != null) {
                    Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp)) {
                        Column(Modifier.padding(12.dp)) {
                            Text("حالت آزمایشی: کد شما ${faDigits(devCode!!)} است", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                            TextButton(onClick = { code = devCode!! }) { Text("استفاده از این کد") }
                        }
                    }
                }
                ErrorText(error)
                AppButton("تأیید و ورود", ::verify, loading = busy)
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                    TextButton(onClick = ::requestCode, enabled = !busy && resendIn == 0) {
                        Text(if (resendIn > 0) "ارسال مجدد تا ${faNumber(resendIn)} ثانیه" else "ارسال مجدد کد")
                    }
                    TextButton(onClick = { step = "phone"; error = null }) { Text("تغییر شماره") }
                }
            }
        }

        Spacer(Modifier.height(12.dp))
        Text(
            "برگزیدهٔ استارتاپ ویکند غذا و تغذیهٔ تبریز — ۱۴۰۵",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(24.dp))
    }
}

private fun JSONObject.str(key: String): String? = if (isNull(key)) null else optString(key, "").takeIf { it.isNotEmpty() }
