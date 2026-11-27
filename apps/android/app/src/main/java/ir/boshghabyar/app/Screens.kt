package ir.boshghabyar.app

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.EventAvailable
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Surface
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.File

private fun JSONObject.str(key: String): String? = if (isNull(key)) null else optString(key, "").takeIf { it.isNotEmpty() }

// ============================ خانه ============================

private class HomeData(val report: DayReport, val meals: List<MealEntry>, val foods: Map<String, Food>)

@Composable
fun HomeScreen(
    app: AppState,
    onNavigate: (String) -> Unit,
    onOpenCamera: () -> Unit,
    onOpenSuggestions: () -> Unit,
) {
    val user = app.user ?: return
    val api = app.api
    val scope = rememberCoroutineScope()
    var data by remember { mutableStateOf<HomeData?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var checkingIn by remember { mutableStateOf(false) }

    suspend fun load() {
        apiResult {
            val daily = api.get("/api/reports/daily")
            val all = api.get("/api/meals")
            HomeData(
                report = DayReport.from(daily.optJSONObject("report")),
                meals = MealEntry.list(all.optJSONArray("meals")),
                foods = Food.list(all.optJSONArray("foods")).associateBy { it.id },
            )
        }.onSuccess { data = it; error = null }.onFailure { error = ApiClient.message(it) }
    }

    fun checkin() {
        scope.launch {
            checkingIn = true
            apiResult { CheckinResult.from(api.post("/api/club/checkin")) }
                .onSuccess {
                    app.notify(scope, if (it.alreadyDone) "حضور امروز ثبت شده است" else "+${faNumber(it.awarded)} ژتون · زنجیرهٔ ${faNumber(it.streak)} روزه")
                    app.refreshUser()
                }
                .onFailure { app.notify(scope, ApiClient.message(it)) }
            checkingIn = false
        }
    }

    LaunchedEffect(Unit) {
        api.track("page.viewed", JSONObject().put("page", "home"))
        load()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        ScreenHeader("سلام ${user.name} 👋", "خلاصهٔ تغذیهٔ امروز شما")
        val current = data
        if (current != null && current.report.entryCount == 0) {
            AppCard {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Filled.EventAvailable, contentDescription = null, tint = MaterialTheme.colorScheme.tertiary, modifier = Modifier.size(26.dp))
                    Column(Modifier.weight(1f)) {
                        Text("هنوز وعده‌ای ثبت نکرده‌اید", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        Text("برای دیدن پیشرفت امروز، اولین وعدهٔ خود را ثبت کنید.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
        when {
            current != null -> {
                TodayCard(current.report)
                MacrosCard(current.report)
            }
            error != null -> ErrorState(error!!) { error = null; scope.launch { load() } }
            else -> LoadingText()
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            QuickAction(Icons.Filled.AddCircle, "ثبت وعده", Modifier.weight(1f)) { onNavigate("log") }
            QuickAction(Icons.Filled.CameraAlt, "عکس غذا", Modifier.weight(1f), onClick = onOpenCamera)
            QuickAction(Icons.Filled.EventAvailable, "حضور روزانه", Modifier.weight(1f), enabled = !checkingIn, onClick = ::checkin)
        }
        RecentMealsCard(current, onOpenSuggestions)
    }
}

@Composable
private fun TodayCard(report: DayReport) {
    val target = report.goal.calorieTarget.coerceAtLeast(1)
    val kcal = report.totals.kcal
    val over = kcal > target
    val color = if (over) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
    AppCard {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(18.dp)) {
            ProgressRing(fraction = kcal.toFloat() / target, color = color, size = 132) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(faNumber(kcal), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    Text("از ${faNumber(target)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Metric(if (over) "بیش از هدف" else "باقی‌مانده", faNumber(kotlin.math.abs(target - kcal)), "کیلوکالری")
                Metric("وعده‌های امروز", faNumber(report.entryCount))
            }
        }
    }
}

@Composable
private fun MacrosCard(report: DayReport) {
    val goal = report.goal
    val totals = report.totals
    AppCard {
        SectionTitle("پیشرفت اهداف")
        MacroRow("پروتئین", totals.protein, goal.proteinTarget, "گرم")
        MacroRow("کربوهیدرات", totals.carbs, goal.carbsTarget, "گرم")
        MacroRow("چربی", totals.fat, goal.fatTarget, "گرم")
        val spent = kotlin.math.round(report.budgetRatio * goal.dailyBudgetIRR).toInt()
        ProgressRow(
            label = "بودجه",
            fraction = report.budgetRatio.toFloat(),
            valueText = "${faMoney(spent)} از ${faMoney(goal.dailyBudgetIRR)} تومان",
            color = if (report.budgetRatio > 1) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
        )
    }
}

@Composable
private fun MacroRow(label: String, value: Int, target: Int, unit: String) {
    val safe = target.coerceAtLeast(1)
    ProgressRow(
        label = label,
        fraction = value.toFloat() / safe,
        valueText = "${faNumber(value)} از ${faNumber(safe)} $unit",
        color = if (value > safe) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
    )
}

@Composable
private fun QuickAction(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.height(88.dp),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
    ) {
        Column(Modifier.padding(8.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(26.dp))
            Text(label, style = MaterialTheme.typography.labelMedium, textAlign = TextAlign.Center, maxLines = 1)
        }
    }
}

@Composable
private fun RecentMealsCard(data: HomeData?, onOpenSuggestions: () -> Unit) {
    AppCard {
        SectionTitle("وعده‌های اخیر")
        if (data == null || data.meals.isEmpty()) {
            EmptyState(Icons.Filled.Restaurant, "هنوز وعده‌ای ثبت نشده", "اولین وعدهٔ خود را ثبت کنید تا گزارش و پیشنهادها ساخته شوند.")
        } else {
            data.meals.take(5).forEach { meal ->
                val food = data.foods[meal.foodId]
                Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(food?.nameFa ?: meal.foodId, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        Text("${MEAL_LABELS[meal.mealType] ?: meal.mealType} · ${faNumber(meal.grams)} گرم", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            AppButton("مشاهدهٔ پیشنهادها", onOpenSuggestions, variant = ButtonVariant.Secondary)
        }
    }
}

@Composable
private fun ErrorState(message: String, retry: () -> Unit) {
    AppCard {
        ErrorText(message)
        AppButton("تلاش دوباره", retry, variant = ButtonVariant.Outline)
    }
}

// ============================ ثبت وعده ============================

@Composable
fun LogScreen(app: AppState, autoCamera: Boolean, onOpenSuggestions: () -> Unit, onOpenScanFood: () -> Unit) {
    val api = app.api
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var foods by remember { mutableStateOf<List<Food>>(emptyList()) }
    var selectedId by remember { mutableStateOf("") }
    var query by remember { mutableStateOf("") }
    var grams by remember { mutableStateOf("150") }
    var mealType by remember { mutableStateOf("lunch") }
    var suggestions by remember { mutableStateOf<List<Suggestion>>(emptyList()) }
    var busy by remember { mutableStateOf(false) }
    var analyzing by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var success by remember { mutableStateOf<String?>(null) }
    var recognition by remember { mutableStateOf<RecognizeResult?>(null) }
    var source by remember { mutableStateOf("manual") }

    val photoUri = remember { mutableStateOf<Uri?>(null) }

    fun processImage(uri: Uri) {
        scope.launch {
            analyzing = true
            error = null
            recognition = null
            try {
                val bytes = ImageUtil.compress(context, uri)
                val res = api.postBytes("/api/recognize", bytes, "image/jpeg")
                recognition = RecognizeResult.from(res)
                if (res.optBoolean("demo")) {
                    app.notify(scope, "نتیجهٔ آزمایشی است (سرویس تشخیص واقعی وصل نشده)")
                }
            } catch (e: Exception) {
                error = ApiClient.message(e)
            }
            analyzing = false
        }
    }

    val takePicture = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
        if (saved) photoUri.value?.let { processImage(it) }
    }
    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri?.let { processImage(it) }
    }

    fun capturePhoto() {
        val dir = File(context.cacheDir, "camera").apply { mkdirs() }
        val file = File(dir, "food_${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        photoUri.value = uri
        takePicture.launch(uri)
    }

    suspend fun loadFoods() {
        apiResult { Food.list(api.get("/api/foods").optJSONArray("foods")) }
            .onSuccess {
                foods = it
                if (selectedId.isBlank()) selectedId = it.firstOrNull()?.id.orEmpty()
            }
            .onFailure { error = ApiClient.message(it) }
    }

    LaunchedEffect(Unit) {
        api.track("page.viewed", JSONObject().put("page", "log_meal"))
        loadFoods()
    }

    LaunchedEffect(autoCamera) {
        if (autoCamera) capturePhoto()
    }

    val selected = foods.firstOrNull { it.id == selectedId }
    val gramsNumber = grams.toIntOrNull() ?: 0
    val kcal = (selected?.per100g?.kcal ?: 0) * gramsNumber / 100
    val filtered = foods.filter { query.isBlank() || it.nameFa.contains(query.trim()) }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        ScreenHeader("ثبت وعده", "غذا، اندازهٔ سهم و نوع وعده را انتخاب کنید.")

        AppCard {
            SectionTitle("تشخیص با عکس")
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                AppButton("عکس بگیر", ::capturePhoto, Modifier.weight(1f), loading = analyzing)
                AppButton("از گالری", { pickImage.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }, Modifier.weight(1f), variant = ButtonVariant.Secondary)
            }
            AppButton("افزودن محصول با بارکد", onOpenScanFood, variant = ButtonVariant.Outline, modifier = Modifier.padding(top = 8.dp))
            if (recognition != null) {
                val rec = recognition!!
                Spacer(Modifier.height(10.dp))
                if (rec.detection != null) {
                    Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                                Text(rec.detection.foodNameFa, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            }
                            ConfidenceChip(rec.detection.confidence)
                            Text("مقدار پیشنهادی: ${faNumber(rec.detection.suggestedGrams)} گرم", style = MaterialTheme.typography.bodySmall)
                            if (rec.detection.alternatives.isNotEmpty()) {
                                Text("گزینه‌های دیگر:", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Row(Modifier.horizontalScroll(rememberScrollState())) {
                                    rec.detection.alternatives.forEach { alt ->
                                        FilterChip(selected = false, onClick = {
                                            selectedId = alt.foodId
                                            grams = rec.detection.suggestedGrams.toString()
                                            source = "camera"
                                        }, label = { Text(alt.foodNameFa) }, modifier = Modifier.padding(end = 6.dp))
                                    }
                                }
                            }
                            AppButton("استفاده از این غذا", {
                                selectedId = rec.detection.foodId
                                grams = rec.detection.suggestedGrams.toString()
                                source = "camera"
                                recognition = null
                            }, variant = ButtonVariant.Accent)
                        }
                    }
                } else {
                    Text(rec.messageFa ?: "غذا شناسایی نشد؛ دستی انتخاب کنید", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        AppCard {
            SectionTitle("انتخاب غذا")
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                placeholder = { Text("جستجوی غذا…") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                shape = RoundedCornerShape(12.dp),
            )
            Row(Modifier.horizontalScroll(rememberScrollState())) {
                filtered.forEach { food ->
                    FilterChip(
                        selected = food.id == selectedId,
                        onClick = { selectedId = food.id },
                        label = { Text(food.nameFa) },
                        modifier = Modifier.padding(end = 6.dp),
                    )
                }
            }
            selected?.let {
                Text(
                    "سهم معمولی: ${faNumber(it.servingGrams)} گرم · ${faNumber(it.per100g.kcal)} کیلوکالری در ۱۰۰ گرم",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }

        AppCard {
            SectionTitle("جزئیات")
            PersianField("وزن (گرم)", grams, { grams = it }, numeric = true)
            Row(Modifier.horizontalScroll(rememberScrollState())) {
                listOf("breakfast", "lunch", "dinner", "snack").forEach { type ->
                    FilterChip(selected = mealType == type, onClick = { mealType = type }, label = { Text(MEAL_LABELS[type] ?: type) }, modifier = Modifier.padding(end = 6.dp))
                }
            }
            Text("تخمین کالری: ${faNumber(kcal)}", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp))
            ErrorText(error)
            if (!success.isNullOrBlank()) Text(success!!, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
            AppButton(
                "ثبت وعده",
                enabled = selectedId.isNotBlank() && gramsNumber > 0,
                loading = busy,
                onClick = {
                    scope.launch {
                        busy = true
                        error = null
                        success = null
                        apiResult {
                            val body = JSONObject()
                                .put("foodId", selectedId)
                                .put("grams", gramsNumber)
                                .put("mealType", mealType)
                                .put("source", source)
                            api.post("/api/meals", body)
                        }.onSuccess { created ->
                            val tokens = created.optInt("tokensEarned", 0)
                            success = "ثبت شد · ${faNumber(kcal)} کیلوکالری" + if (tokens > 0) " · +${faNumber(tokens)} ژتون" else ""
                            source = "manual"
                            app.refreshUser()
                            apiResult { api.get("/api/recommendations/${created.optString("id")}") }
                                .onSuccess { suggestions = Suggestion.list(it.optJSONArray("suggestions")) }
                                .onFailure { }
                        }.onFailure { error = ApiClient.message(it) }
                        busy = false
                    }
                },
            )
        }

        if (suggestions.isNotEmpty()) {
            AppCard {
                SectionTitle("پیشنهادهای جایگزین")
                suggestions.forEach { s ->
                    Text(s.titleFa, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    Text(s.reasonFa, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 8.dp))
                }
                AppButton("مشاهدهٔ همهٔ پیشنهادها", onOpenSuggestions, variant = ButtonVariant.Outline)
            }
        }
    }
}

@Composable
private fun ConfidenceChip(confidence: Double) {
    val (label, container, content) = when {
        confidence >= 0.8 -> Triple("تشخیص مطمئن", AppColors.SuccessContainer, AppColors.Success)
        confidence >= 0.5 -> Triple("تشخیص متوسط", AppColors.WarningContainer, AppColors.Warning)
        else -> Triple("تشخیص نامطمئن", AppColors.ErrorContainer, AppColors.Error)
    }
    Badge(label, container, content)
}

// ============================ گزارش‌ها ============================

@Composable
fun ReportsScreen(app: AppState, onOpenClub: () -> Unit) {
    var tab by remember { mutableIntStateOf(0) }
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        ScreenHeader("گزارش‌ها", "روند کالری و تحلیل تغذیه")
        TabRow(selectedTabIndex = tab, containerColor = MaterialTheme.colorScheme.surfaceVariant) {
            Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text("خلاصه") })
            Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("تکمیلی") })
        }
        Spacer(Modifier.height(12.dp))
        when (tab) {
            0 -> WeeklySection(app.api)
            else -> DetailedSection(app, onOpenClub)
        }
    }
}

@Composable
private fun WeeklySection(api: ApiClient) {
    var report by remember { mutableStateOf<WeeklyReport?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        api.track("page.viewed", JSONObject().put("page", "reports"))
        apiResult { WeeklyReport.from(api.get("/api/reports/weekly?days=7")) }
            .onSuccess { report = it }
            .onFailure { error = ApiClient.message(it) }
    }
    Column(Modifier.verticalScroll(rememberScrollState())) {
        ErrorText(error)
        val r = report
        if (r == null) {
            if (error == null) LoadingText()
        } else {
            AppCard {
                MetricRow(
                    { Metric("میانگین کالری", faNumber(kotlin.math.round(r.averageKcal)), "کیلوکالری") },
                    { Metric("روزهای فعال", "${faNumber(r.activeDays)}/${faNumber(r.trend.size)}", "ثبت وعده") },
                )
                MetricRow(
                    { Metric("میانگین پروتئین", faNumber(r.averageProtein), "گرم") },
                    { Metric("وعده‌ها", faNumber(r.totalMeals), "در هفته") },
                )
            }
            AppCard {
                SectionTitle("کالری روزانه")
                BarChart(
                    values = r.trend.map { it.kcal },
                    labels = r.trend.map { jalaliDate(it.date, withYear = false) },
                )
                Spacer(Modifier.height(8.dp))
                Text(r.insight, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun DetailedSection(app: AppState, onOpenClub: () -> Unit) {
    var state by remember { mutableStateOf<DetailedState>(DetailedState.Loading) }
    var days by remember { mutableIntStateOf(30) }
    val scope = rememberCoroutineScope()

    suspend fun load() {
        state = DetailedState.Loading
        apiResult { apiCallDetailed(app.api, days) }
            .onSuccess { state = it }
            .onFailure { state = DetailedState.Error(ApiClient.message(it)) }
    }

    LaunchedEffect(days) { load() }

    Column(Modifier.verticalScroll(rememberScrollState())) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(7, 30, 90).forEach { d ->
                FilterChip(selected = days == d, onClick = { days = d }, label = { Text("${faNumber(d)} روز") })
            }
        }
        Spacer(Modifier.height(10.dp))
        when (val s = state) {
            is DetailedState.Loading -> LoadingText()
            is DetailedState.Error -> ErrorState(s.message) { scope.launch { load() } }
            is DetailedState.Locked -> LockedDetailed(s.sections, onOpenClub, app)
            is DetailedState.Ready -> DetailedReportView(s.report)
        }
    }
}

private sealed interface DetailedState {
    data object Loading : DetailedState
    data class Error(val message: String) : DetailedState
    data class Locked(val sections: List<String>) : DetailedState
    data class Ready(val report: DetailedReport) : DetailedState
}

private suspend fun apiCallDetailed(api: ApiClient, days: Int): DetailedState {
    val res = api.get("/api/reports/detailed?days=$days")
    if (res.optBoolean("locked")) {
        val sections = mutableListOf<String>()
        res.optJSONArray("sections")?.let { arr -> for (i in 0 until arr.length()) sections.add(arr.optJSONObject(i).optString("titleFa")) }
        return DetailedState.Locked(sections)
    }
    return DetailedState.Ready(DetailedReport.from(res.optJSONObject("report")))
}

@Composable
private fun LockedDetailed(sections: List<String>, onOpenClub: () -> Unit, app: AppState) {
    val scope = rememberCoroutineScope()
    AppCard {
        SectionTitle("گزارش تکمیلی 🔒", "این گزارش با نسخهٔ حرفه‌ای یا ژتون باشگاه باز می‌شود")
        sections.forEach { s ->
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 4.dp)) {
                Text("🔒", style = MaterialTheme.typography.bodyMedium)
                Spacer(Modifier.width(8.dp))
                Text(s, style = MaterialTheme.typography.bodyMedium)
            }
        }
        Spacer(Modifier.height(8.dp))
        AppButton("ارتقا به حرفه‌ای", {
            scope.launch {
                apiResult { app.api.post("/api/upgrade", JSONObject().put("plan", "pro")) }
                    .onSuccess { app.refreshUser(); app.notify(scope, "نسخهٔ حرفه‌ای فعال شد") }
                    .onFailure { app.notify(scope, ApiClient.message(it)) }
            }
        }, variant = ButtonVariant.Accent)
        AppButton("با ژتون باشگاه فعال کن", onOpenClub, variant = ButtonVariant.Secondary)
    }
}

@Composable
private fun DetailedReportView(report: DetailedReport) {
    AppCard {
        SectionTitle("امتیاز تعادل", "از ۱۰۰")
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(18.dp)) {
            ProgressRing(fraction = report.score / 100f, color = MaterialTheme.colorScheme.primary, size = 110) {
                Text(faNumber(report.score), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Metric("روزهای فعال", "${faNumber(report.activeDays)}/${faNumber(report.days)}")
                Metric("وعده‌ها", faNumber(report.totalMeals))
                Metric("زنجیرهٔ ثبت", "${faNumber(report.longestStreak)} روز")
            }
        }
    }
    AppCard {
        SectionTitle("سهم انرژی درشت‌مغذی‌ها")
        SplitBar(report.macroSplitProtein, report.macroSplitCarbs, report.macroSplitFat)
    }
    AppCard {
        SectionTitle("پایبندی به هدف")
        ProgressRow("کالری در محدوده", report.adherenceKcalPct / 100f, "${faNumber(report.adherenceKcalPct)}٪")
        ProgressRow("پروتئین", report.adherenceProteinPct / 100f, "${faNumber(report.adherenceProteinPct)}٪")
        ProgressRow("بودجه", report.adherenceBudgetPct / 100f, "${faNumber(report.adherenceBudgetPct)}٪")
    }
    if (report.mealTypes.any { it.count > 0 }) {
        AppCard {
            SectionTitle("توزیع بین وعده‌ها")
            report.mealTypes.forEach { m ->
                if (m.count > 0) {
                    ProgressRow(m.labelFa, m.sharePct / 100f, "${faNumber(m.sharePct)}٪ · ${faNumber(m.kcal)} کیلوکالری")
                }
            }
        }
    }
    if (report.topFoods.isNotEmpty()) {
        AppCard {
            SectionTitle("پرمصرف‌ترین غذاها")
            report.topFoods.forEachIndexed { i, f ->
                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(faNumber(i + 1), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(f.nameFa, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        Text("${faNumber(f.count)} بار · ${faNumber(f.grams)} گرم · ${faNumber(f.kcal)} کیلوکالری", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
    AppCard {
        SectionTitle("تحلیل‌های شخصی")
        report.insights.forEach { insight ->
            Row(Modifier.padding(vertical = 4.dp), verticalAlignment = Alignment.Top) {
                Text("•", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.width(8.dp))
                Text(insight, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun SplitBar(protein: Int, carbs: Int, fat: Int) {
    val total = (protein + carbs + fat).coerceAtLeast(1)
    Row(Modifier.fillMaxWidth().height(20.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.weight(protein.toFloat()).fillMaxSize().background(AppColors.Primary, RoundedCornerShape(topStart = 8.dp, bottomStart = 8.dp)))
        Box(Modifier.weight(carbs.toFloat()).fillMaxSize().background(AppColors.Secondary))
        Box(Modifier.weight(fat.toFloat()).fillMaxSize().background(AppColors.Gold, RoundedCornerShape(topEnd = 8.dp, bottomEnd = 8.dp)))
    }
    Spacer(Modifier.height(8.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Legend("پروتئین", AppColors.Primary, "${faNumber(protein)}٪")
        Legend("کربوهیدرات", AppColors.Secondary, "${faNumber(carbs)}٪")
        Legend("چربی", AppColors.Gold, "${faNumber(fat)}٪")
    }
}

@Composable
private fun Legend(label: String, color: Color, value: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(Modifier.size(10.dp).background(color, CircleShape))
        Text("$label $value", style = MaterialTheme.typography.labelSmall)
    }
}

// ============================ باشگاه ============================

@Composable
fun ClubScreen(app: AppState) {
    val api = app.api
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var club by remember { mutableStateOf<ClubState?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    suspend fun load() {
        apiResult { ClubState.from(api.get("/api/club")) }
            .onSuccess { club = it; error = null }
            .onFailure { error = ApiClient.message(it) }
    }

    LaunchedEffect(Unit) { load() }

    fun checkin() {
        scope.launch {
            busy = true
            apiResult { CheckinResult.from(api.post("/api/club/checkin")) }
                .onSuccess {
                    app.notify(scope, if (it.alreadyDone) "حضور امروز ثبت شده است" else "+${faNumber(it.awarded)} ژتون · زنجیرهٔ ${faNumber(it.streak)} روزه")
                    app.refreshUser()
                    load()
                }
                .onFailure { app.notify(scope, ApiClient.message(it)) }
            busy = false
        }
    }

    fun redeem(reward: Reward) {
        scope.launch {
            busy = true
            apiResult { api.post("/api/club/redeem", JSONObject().put("rewardId", reward.id)) }
                .onSuccess { res ->
                    app.notify(scope, "${reward.titleFa} فعال شد")
                    res.optJSONObject("user")?.let { app.user = AppUser.from(it) }
                    load()
                }
                .onFailure { app.notify(scope, ApiClient.message(it)) }
            busy = false
        }
    }

    fun shareCode() {
        val code = club?.referralCode ?: return
        val intent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(android.content.Intent.EXTRA_TEXT, "با کد معرف من در بشقاب‌یار ثبت‌نام کن و ۲۰ ژتون هدیه بگیر: $code")
        }
        context.startActivity(android.content.Intent.createChooser(intent, "معرفی بشقاب‌یار"))
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        ScreenHeader("باشگاه مشتریان", "ژتون بگیرید و جایزه بگیرید")
        ErrorText(error)
        val c = club
        if (c == null) {
            if (error == null) LoadingText()
        } else {
            AppCard {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Column(Modifier.weight(1f)) {
                        Text("🪙", style = MaterialTheme.typography.displaySmall)
                        Text("${faNumber(c.balance)} ژتون", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = AppColors.Gold)
                        Text("کسب‌شدهٔ کل: ${faNumber(c.tokensEarned)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Badge(c.levelLabelFa, AppColors.GoldContainer, AppColors.Gold)
                        if (c.nextLevelLabelFa != null) {
                            Text("${faNumber(c.levelRemaining)} ژتون تا ${c.nextLevelLabelFa}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
                ProgressRow("پیشرفت سطح", c.levelProgressPct / 100f, "${faNumber(c.levelProgressPct)}٪")
                AppButton(if (c.checkedInToday) "حضور امروز ثبت شد" else "حضور روزانه (+${faNumber(2)} ژتون)", ::checkin, loading = busy, enabled = !c.checkedInToday)
            }

            AppCard {
                SectionTitle("معرفی به دوستان")
                Text("دوست شما +${faNumber(c.referralInvitee)} ژتون و شما بعد از اولین وعدهٔ دوست +${faNumber(c.referralInviter)} ژتون می‌گیرید.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(12.dp), modifier = Modifier.weight(1f)) {
                        Text(c.referralCode ?: "—", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, modifier = Modifier.padding(12.dp))
                    }
                    AppButton("اشتراک‌گذاری", ::shareCode, Modifier.weight(1f), variant = ButtonVariant.Secondary)
                }
                if (c.invited.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    SectionTitle("دعوت‌های شما", "${faNumber(c.invitedCount)} نفر · ${faNumber(c.rewardedCount)} پاداش")
                    c.invited.take(10).forEach { f ->
                        Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(f.name, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                            Badge(
                                when (f.status) {
                                    "rewarded" -> "پاداش گرفته"
                                    "capped" -> "سقف ماهانه"
                                    else -> "در انتظار اولین وعده"
                                },
                                if (f.status == "rewarded") AppColors.SuccessContainer else AppColors.SurfaceVariant,
                                if (f.status == "rewarded") AppColors.Success else AppColors.OnSurfaceVariant,
                            )
                        }
                    }
                }
            }

            AppCard {
                SectionTitle("جایزه‌ها")
                c.rewards.forEach { reward ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(reward.titleFa, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                            Text(reward.descriptionFa, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Spacer(Modifier.width(8.dp))
                        Column(horizontalAlignment = Alignment.End) {
                            Text("${faNumber(reward.costTokens)} ژتون", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = AppColors.Gold)
                            TextButton(onClick = { redeem(reward) }, enabled = !busy && c.balance >= reward.costTokens) {
                                Text("فعال‌سازی")
                            }
                        }
                    }
                    HorizontalDivider(color = AppColors.Border.copy(alpha = 0.5f))
                }
            }

            if (c.ledger.isNotEmpty()) {
                AppCard {
                    SectionTitle("دفتر ژتون‌ها")
                    c.ledger.take(15).forEach { e ->
                        Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(LEDGER_REASON_LABELS[e.reason] ?: e.reason, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                            Text(
                                (if (e.delta > 0) "+" else "") + faNumber(e.delta),
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Bold,
                                color = if (e.delta > 0) AppColors.Success else MaterialTheme.colorScheme.error,
                            )
                        }
                    }
                }
            }
        }
    }
}

// ============================ نمایه ============================

@Composable
fun ProfileScreen(app: AppState, onLogout: () -> Unit, onSessionEnded: () -> Unit, onOpenHealth: () -> Unit = {}) {
    val api = app.api
    val scope = rememberCoroutineScope()
    val user = app.user ?: return
    var goal by remember(user.id) { mutableStateOf(user.goal) }
    var name by remember(user.id) { mutableStateOf(user.name) }
    var consent by remember(user.id) { mutableStateOf(user.researchConsent) }
    var error by remember { mutableStateOf<String?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var showDelete by remember { mutableStateOf(false) }

    fun saveGoal() {
        scope.launch {
            busy = true
            error = null
            message = null
            apiResult { api.patch("/api/me/goal", goal.toJson()) }
                .onSuccess { res ->
                    val updated = AppUser.from(res.getJSONObject("user"))
                    app.user = updated
                    goal = updated.goal
                    message = "اهداف ذخیره شد"
                }
                .onFailure { error = ApiClient.message(it) }
            busy = false
        }
    }

    fun saveProfile() {
        scope.launch {
            busy = true
            error = null
            apiResult { api.patch("/api/me", JSONObject().put("name", name.trim()).put("researchConsent", consent)) }
                .onSuccess { res -> app.user = AppUser.from(res.getJSONObject("user")) }
                .onFailure { error = ApiClient.message(it) }
            busy = false
        }
    }

    fun upgrade() {
        scope.launch {
            busy = true
            error = null
            apiResult { api.post("/api/upgrade", JSONObject().put("plan", "pro")) }
                .onSuccess { res -> app.user = AppUser.from(res.getJSONObject("user")); message = "نسخهٔ حرفه‌ای فعال شد" }
                .onFailure { error = ApiClient.message(it) }
            busy = false
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        ScreenHeader("نمایه و اهداف", "${user.name} · ${user.phone ?: user.email ?: ""}")

        AppCard {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PlanBadge(user.isPro)
                TokenChip(user.tokenBalance)
                if (user.proUntil != null) Text("تا ${jalaliDate(user.proUntil!!.take(10))}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.height(12.dp))
            PersianField("نام", name, { name = it })
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                Switch(checked = consent, onCheckedChange = { consent = it })
                Text("مشارکت در پژوهش با داده‌های ناشناس", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            AppButton("ذخیرهٔ پروفایل", ::saveProfile, variant = ButtonVariant.Secondary, loading = busy)
        }

        AppCard {
            SectionTitle("نوع هدف")
            Row(Modifier.horizontalScroll(rememberScrollState())) {
                GOAL_LABELS.forEach { (value, label) ->
                    FilterChip(selected = goal.goalType == value, onClick = { goal = goal.copy(goalType = value) }, label = { Text(label) }, modifier = Modifier.padding(end = 6.dp))
                }
            }
            PersianField("کالری روزانه", goal.calorieTarget.toString(), { goal = goal.copy(calorieTarget = it.toIntOrNull() ?: 0) }, numeric = true)
            PersianField("پروتئین (گرم)", goal.proteinTarget.toString(), { goal = goal.copy(proteinTarget = it.toIntOrNull() ?: 0) }, numeric = true)
            PersianField("کربوهیدرات (گرم)", goal.carbsTarget.toString(), { goal = goal.copy(carbsTarget = it.toIntOrNull() ?: 0) }, numeric = true)
            PersianField("چربی (گرم)", goal.fatTarget.toString(), { goal = goal.copy(fatTarget = it.toIntOrNull() ?: 0) }, numeric = true)
            PersianField("فیبر (گرم)", goal.fiberTarget.toString(), { goal = goal.copy(fiberTarget = it.toIntOrNull() ?: 0) }, numeric = true)
            PersianField("بودجه روزانه (تومان)", goal.dailyBudgetIRR.toString(), { goal = goal.copy(dailyBudgetIRR = it.toIntOrNull() ?: 0) }, numeric = true)
            ErrorText(error)
            if (!message.isNullOrBlank()) Text(message!!, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
            AppButton("ذخیرهٔ اهداف", ::saveGoal, loading = busy)
        }

        AppCard {
            SectionTitle("اشتراک")
            Text("نسخهٔ رایگان شامل ۲۰ غذای ایرانی، ۷ روز تاریخچه و گزارش پایه است.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (!user.isPro) AppButton("ارتقا به حرفه‌ای", ::upgrade, variant = ButtonVariant.Accent, loading = busy)
        }

        AppButton("شاخص‌های سلامتی (قند، وزن، فشار و …)", onOpenHealth, variant = ButtonVariant.Secondary)
        AppButton("خروج از حساب", onLogout, variant = ButtonVariant.Secondary)
        AppButton("خروج از همهٔ دستگاه‌ها", {
            scope.launch { apiResult { api.post("/api/auth/logout-all") }; onSessionEnded() }
        }, variant = ButtonVariant.Outline)
        TextButton(onClick = { showDelete = true }, modifier = Modifier.fillMaxWidth()) {
            Text("حذف حساب کاربری", color = MaterialTheme.colorScheme.error)
        }
    }

    if (showDelete) {
        AlertDialog(
            onDismissRequest = { showDelete = false },
            title = { Text("حذف حساب") },
            text = { Text("همهٔ داده‌های شما برای همیشه حذف می‌شود. این کار قابل بازگشت نیست.") },
            confirmButton = {
                TextButton(onClick = {
                    showDelete = false
                    scope.launch {
                        apiResult { api.delete("/api/me", JSONObject().put("confirm", true)) }
                            .onSuccess { onSessionEnded() }
                            .onFailure { error = ApiClient.message(it) }
                    }
                }) { Text("حذف", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { showDelete = false }) { Text("انصراف") } },
        )
    }
}

// ============================ پیشنهادها ============================

@Composable
fun SuggestionsScreen(app: AppState) {
    val api = app.api
    val scope = rememberCoroutineScope()
    var meals by remember { mutableStateOf<List<MealEntry>>(emptyList()) }
    var foods by remember { mutableStateOf<Map<String, Food>>(emptyMap()) }
    var suggestions by remember { mutableStateOf<List<Suggestion>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var calculating by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        api.track("page.viewed", JSONObject().put("page", "suggestions"))
        apiResult {
            val res = api.get("/api/meals")
            Pair(MealEntry.list(res.optJSONArray("meals")), Food.list(res.optJSONArray("foods")).associateBy { it.id })
        }.onSuccess { (m, f) -> meals = m; foods = f }
            .onFailure { error = ApiClient.message(it) }
        loading = false
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        ScreenHeader("پیشنهادها", "برای هر وعدهٔ ثبت‌شده، جایگزین متعادل و اقتصادی ببینید.")
        ErrorText(error)
        AppCard {
            SectionTitle("وعده‌های ثبت‌شده")
            if (loading) LoadingText()
            else if (meals.isEmpty()) EmptyState(Icons.Filled.Restaurant, "ابتدا یک وعده ثبت کنید")
            else {
                meals.forEach { meal ->
                        Column(
                            Modifier.fillMaxWidth().clickable {
                                scope.launch {
                                    calculating = true
                                    error = null
                                    apiResult { Suggestion.list(api.get("/api/recommendations/${meal.id}").optJSONArray("suggestions")) }
                                        .onSuccess { suggestions = it }
                                        .onFailure { error = ApiClient.message(it) }
                                    calculating = false
                                }
                            }.padding(vertical = 10.dp),
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(foods[meal.foodId]?.nameFa ?: meal.foodId, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                                    Text("${jalaliDate(meal.date)} · ${faNumber(meal.grams)} گرم", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
                            }
                            HorizontalDivider(color = AppColors.Border.copy(alpha = 0.4f), modifier = Modifier.padding(top = 8.dp))
                        }
                    }
                }
        }
        AppCard {
            SectionTitle("نتیجه")
            if (calculating) LoadingText("در حال محاسبه…")
            else if (suggestions.isEmpty()) EmptyText("جایگزین مناسبی پیدا نشد.")
            else suggestions.forEach { s ->
                Text(s.titleFa, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                Text(s.reasonFa, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 8.dp))
            }
            Text("اعداد توسط موتور محاسبهٔ بشقاب‌یار به‌دست آمده‌اند.", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp))
        }
    }
}

@Composable
fun EmptyText(text: String) {
    Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(vertical = 8.dp))
}

