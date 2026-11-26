package ir.boshghabyar.app

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.FilterChip
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

private fun utcDate(): String {
    val format = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    format.timeZone = TimeZone.getTimeZone("UTC")
    return format.format(Date())
}

fun faNumber(value: Number): String = value.toString().map { c ->
    if (c in '0'..'9') ('۰'.code + (c - '0')).toChar() else c
}.joinToString("")

@Composable
fun LoginScreen(
    api: ApiClient,
    store: SessionStore,
    onAuthenticated: (AppUser) -> Unit,
) {
    var mode by remember { mutableStateOf("login") }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
    ) {
        Text("بشقاب‌یار", style = TextStyle(fontSize = 32.sp, fontWeight = FontWeight.Bold, color = AppColors.Primary))
        Text("همراه هوشمند وعدههای ایرانی", style = TitleStyle, modifier = Modifier.padding(top = 24.dp))
        Text(
            "وعده را ثبت کنید، کالری و هزینه آن را ببینید و جایگزین متعادلتر بیابید.",
            style = SmallStyle,
            modifier = Modifier.padding(bottom = 24.dp),
        )

        AppCard {
            SectionTitle(if (mode == "login") "ورود به حساب" else "ثبتنام")
            if (mode == "register") {
                PersianField("نام", name, { name = it })
            }
            PersianField("ایمیل", email, { email = it }, placeholder = "you@example.com")
            PersianField("رمز عبور", password, { password = it }, placeholder = "حداقل ۸ کاراکتر", secure = true)
            ErrorText(error)

            AppButton(
                text = if (mode == "login") "ورود" else "ساخت حساب",
                loading = busy,
                onClick = {
                    scope.launch {
                        busy = true
                        error = null
                        try {
                            val body = if (mode == "login") {
                                JSONObject().put("email", email.trim()).put("password", password)
                            } else {
                                JSONObject().put("name", name.trim()).put("email", email.trim()).put("password", password)
                            }
                            val path = if (mode == "login") "/api/auth/login" else "/api/auth/register"
                            val (token, user) = api.auth(path, body)
                            api.token = token
                            store.token = token
                            api.track(if (mode == "login") "ui.login_completed" else "ui.register_completed")
                            onAuthenticated(user)
                        } catch (e: Exception) {
                            error = ApiClient.message(e)
                        } finally {
                            busy = false
                        }
                    }
                },
            )
            TextButton(onClick = {
                mode = if (mode == "login") "register" else "login"
                error = null
            }) {
                Text(if (mode == "login") "حساب ندارید؟ ثبتنام" else "حساب دارید؟ ورود")
            }
        }

        AppButton(
            text = "ورود آزمایشی",
            variant = ButtonVariant.Secondary,
            onClick = {
                scope.launch {
                    busy = true
                    error = null
                    try {
                        val body = JSONObject()
                            .put("email", "demo@boshghabyar.ir")
                            .put("password", "Demo@12345")
                        val (token, user) = api.auth("/api/auth/login", body)
                        api.token = token
                        store.token = token
                        onAuthenticated(user)
                    } catch (e: Exception) {
                        error = if (e is ApiException) e.message else "ورود آزمایشی ناموفق بود"
                    } finally {
                        busy = false
                    }
                }
            },
            enabled = !busy,
        )

        Text(
            "برگزیده استارتاپ ویکند غذا و تغذیه تبریز — ۱۴۰۵",
            style = SmallStyle,
            modifier = Modifier.padding(top = 24.dp),
        )
    }
}

@Composable
fun HomeScreen(
    api: ApiClient,
    user: AppUser,
    onNavigate: (String) -> Unit,
) {
    var report by remember { mutableStateOf<DayReport?>(null) }
    var meals by remember { mutableStateOf<List<MealEntry>>(emptyList()) }
    var foods by remember { mutableStateOf<List<Food>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        api.track("page.viewed", JSONObject().put("page", "home"))
        try {
            val daily = api.get("/api/reports/daily")
            val all = api.get("/api/meals")
            report = DayReport.from(daily.optJSONObject("report"))
            meals = MealEntry.list(all.optJSONArray("meals"))
            foods = Food.list(all.optJSONArray("foods"))
        } catch (e: Exception) {
            error = ApiClient.message(e)
        } finally {
            loading = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        Text("سلام ${user.name}", style = TitleStyle)
        Text("خلاصه وعدههای امروز", style = SmallStyle, modifier = Modifier.padding(bottom = 16.dp))

        if (loading) LoadingText()
        ErrorText(error)

        report?.let { r ->
            AppCard {
                MetricRow(
                    {
                        Metric(
                            "کالری",
                            faNumber(Math.round(r.totals.kcal.toDouble())),
                            "هدف ${faNumber(r.goal.calorieTarget)}",
                        )
                    },
                    { Metric("پروتئین", "${faNumber(r.totals.protein)} گرم") },
                )
                MetricRow(
                    {
                        Metric(
                            "هزینه",
                            faNumber(Math.round(r.budgetRatio * r.goal.dailyBudgetIRR)),
                            "تومان",
                        )
                    },
                    { Metric("وعدهها", faNumber(r.entryCount), "امروز") },
                )
            }

            AppCard {
                SectionTitle("پیشرفت اهداف")
                ProgressRow("کالری", r.totals.kcal, r.goal.calorieTarget)
                ProgressRow("پروتئین", r.totals.protein, r.goal.proteinTarget)
                ProgressRow("کربوهیدرات", r.totals.carbs, r.goal.carbsTarget)
                ProgressRow("چربی", r.totals.fat, r.goal.fatTarget)
                ProgressRow("بودجه", r.budgetRatio * 100, 100)
            }
        }

        AppButton("ثبت وعده جدید", onClick = { onNavigate("log") })
        AppButton(
            "مشاهده پیشنهادها",
            variant = ButtonVariant.Secondary,
            onClick = { onNavigate("suggestions") },
        )

        AppCard {
            SectionTitle("وعدههای اخیر")
            if (meals.isEmpty()) {
                EmptyText("هنوز وعدهای ثبت نشده است.")
            } else {
                val names = foods.associateBy { it.id }
                meals.take(5).forEach { meal ->
                    val foodName = names[meal.foodId]?.nameFa ?: meal.foodId
                    Text(
                        "$foodName · ${MEAL_LABELS[meal.mealType] ?: meal.mealType} · ${faNumber(meal.grams)} گرم",
                        style = BodyStyle,
                        modifier = Modifier.padding(vertical = 4.dp),
                    )
                }
            }
        }
    }
}

@Composable
fun LogScreen(api: ApiClient) {
    var foods by remember { mutableStateOf<List<Food>>(emptyList()) }
    var selectedId by remember { mutableStateOf("") }
    var grams by remember { mutableStateOf("150") }
    var mealType by remember { mutableStateOf("lunch") }
    var suggestions by remember { mutableStateOf<List<Suggestion>>(emptyList()) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var success by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        api.track("page.viewed", JSONObject().put("page", "log_meal"))
        try {
            val response = api.get("/api/foods")
            foods = Food.list(response.optJSONArray("foods"))
            selectedId = foods.firstOrNull()?.id.orEmpty()
        } catch (e: Exception) {
            error = ApiClient.message(e)
        }
    }

    val selected = foods.firstOrNull { it.id == selectedId }
    val gramsNumber = grams.toIntOrNull() ?: 0
    val kcal = (selected?.per100g?.kcal ?: 0) * gramsNumber / 100

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        Text("ثبت وعده", style = TitleStyle)
        Text("غذا، اندازه سهم و نوع وعده را انتخاب کنید.", style = SmallStyle, modifier = Modifier.padding(bottom = 16.dp))

        AppCard {
            SectionTitle("انتخاب غذا")
            Row(modifier = Modifier.horizontalScroll(rememberScrollState())) {
                foods.forEach { food ->
                    FilterChip(
                        selected = food.id == selectedId,
                        onClick = { selectedId = food.id },
                        label = { Text(food.nameFa) },
                        modifier = Modifier.padding(end = 8.dp),
                    )
                }
            }
            selected?.let {
                Text(
                    "سهم معمولی: ${faNumber(it.servingGrams)} گرم · ${faNumber(it.per100g.kcal)} کیلوکالوری در ۱۰۰ گرم",
                    style = SmallStyle,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }

        AppCard {
            SectionTitle("جزئیات")
            PersianField("وزن (گرم)", grams, { grams = it }, numeric = true)
            Row(modifier = Modifier.horizontalScroll(rememberScrollState())) {
                listOf("breakfast", "lunch", "dinner", "snack").forEach { type ->
                    FilterChip(
                        selected = mealType == type,
                        onClick = { mealType = type },
                        label = { Text(MEAL_LABELS[type] ?: type) },
                        modifier = Modifier.padding(end = 8.dp),
                    )
                }
            }
            Text("تخمین کالری: ${faNumber(kcal)}", style = SmallStyle, modifier = Modifier.padding(top = 8.dp))
            ErrorText(error)
            if (!success.isNullOrBlank()) {
                Text(success!!, style = TextStyle(fontSize = 14.sp, color = AppColors.Primary))
            }
            AppButton(
                "ثبت وعده",
                enabled = selectedId.isNotBlank() && gramsNumber > 0,
                loading = busy,
                onClick = {
                    scope.launch {
                        busy = true
                        error = null
                        success = null
                        try {
                            val body = JSONObject()
                                .put("foodId", selectedId)
                                .put("grams", gramsNumber)
                                .put("mealType", mealType)
                                .put("date", utcDate())
                            val created = api.post("/api/meals", body)
                            val id = created.optString("id")
                            val recs = api.get("/api/recommendations/$id")
                            suggestions = Suggestion.list(recs.optJSONArray("suggestions"))
                            success = "ثبت شد · ${faNumber(kcal)} کیلوکالوری"
                        } catch (e: Exception) {
                            error = if (e is ApiException) e.message else "خطا در ثبت وعده"
                        } finally {
                            busy = false
                        }
                    }
                },
            )
        }

        if (suggestions.isNotEmpty()) {
            AppCard {
                SectionTitle("پیشنهادهای جایگزین")
                suggestions.forEach { s ->
                    Text(s.titleFa, style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold))
                    Text(s.reasonFa, style = SmallStyle, modifier = Modifier.padding(bottom = 8.dp))
                }
            }
        }
    }
}

@Composable
fun ReportsScreen(api: ApiClient, user: AppUser, onUserChanged: (AppUser) -> Unit) {
    var report by remember { mutableStateOf<WeeklyReport?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        api.track("page.viewed", JSONObject().put("page", "reports"))
        try {
            report = WeeklyReport.from(api.get("/api/reports/weekly?days=7"))
        } catch (e: Exception) {
            error = ApiClient.message(e)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        Text("گزارشها", style = TitleStyle)
        Text("روند هفت روزه کالری و وعدهها", style = SmallStyle, modifier = Modifier.padding(bottom = 16.dp))
        ErrorText(error)

        report?.let { r ->
            AppCard {
                MetricRow(
                    {
                        Metric(
                            "میانگین کالری",
                            faNumber(Math.round(r.averageKcal)),
                            "کیلوکالوری",
                        )
                    },
                    { Metric("روزهای فعال", "${faNumber(r.activeDays)}/۷", "ثبت وعده") },
                )
            }

            AppCard {
                SectionTitle("کالری روزانه")
                val max = r.trend.maxOfOrNull { it.kcal }?.coerceAtLeast(1) ?: 1
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(170.dp),
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.SpaceEvenly,
                ) {
                    r.trend.forEach { point ->
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Box(
                                modifier = Modifier
                                    .height((point.kcal.toFloat() / max * 120f).coerceAtLeast(2f).dp)
                                    .width(18.dp)
                                    .background(AppColors.Primary, RoundedCornerShape(4.dp)),
                            )
                            Text(point.date.takeLast(5), style = TextStyle(fontSize = 10.sp, color = AppColors.TextSecondary))
                        }
                    }
                }
                Text(r.insight, style = SmallStyle, modifier = Modifier.padding(top = 12.dp))
            }

            if (user.plan == "free") {
                AppButton(
                    "ارتقا به حرفهای",
                    variant = ButtonVariant.Accent,
                    loading = busy,
                    onClick = {
                        scope.launch {
                            busy = true
                            try {
                                val result = api.post("/api/upgrade", JSONObject().put("plan", "pro"))
                                onUserChanged(AppUser.from(result.getJSONObject("user")))
                            } catch (e: Exception) {
                                error = ApiClient.message(e)
                            } finally {
                                busy = false
                            }
                        }
                    },
                )
            }
        } ?: LoadingText()
    }
}

@Composable
fun ProfileScreen(
    api: ApiClient,
    user: AppUser,
    onUserChanged: (AppUser) -> Unit,
    onSignOut: () -> Unit,
) {
    var goal by remember(user.id) { mutableStateOf(user.goal) }
    var error by remember { mutableStateOf<String?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        Text("نمایه و اهداف", style = TitleStyle)
        Text("${user.name} · ${user.email}", style = SmallStyle, modifier = Modifier.padding(bottom = 16.dp))

        AppCard {
            Text(
                if (user.plan == "pro") "نسخه حرفهای" else "نسخه رایگان",
                style = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Bold, color = AppColors.Primary),
                modifier = Modifier
                    .background(AppColors.PrimaryLight, RoundedCornerShape(20.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            )
            Spacer(Modifier.height(16.dp))
            SectionTitle("نوع هدف")
            Row(modifier = Modifier.horizontalScroll(rememberScrollState())) {
                GOAL_LABELS.forEach { (value, label) ->
                    FilterChip(
                        selected = goal.goalType == value,
                        onClick = { goal = goal.copy(goalType = value) },
                        label = { Text(label) },
                        modifier = Modifier.padding(end = 8.dp),
                    )
                }
            }
            Spacer(Modifier.height(16.dp))
            PersianField("کالری روزانه", goal.calorieTarget.toString(), { goal = goal.copy(calorieTarget = it.toIntOrNull() ?: 0) }, numeric = true)
            PersianField("پروتئین (گرم)", goal.proteinTarget.toString(), { goal = goal.copy(proteinTarget = it.toIntOrNull() ?: 0) }, numeric = true)
            PersianField("کربوهیدرات (گرم)", goal.carbsTarget.toString(), { goal = goal.copy(carbsTarget = it.toIntOrNull() ?: 0) }, numeric = true)
            PersianField("چربی (گرم)", goal.fatTarget.toString(), { goal = goal.copy(fatTarget = it.toIntOrNull() ?: 0) }, numeric = true)
            PersianField("فیبر (گرم)", goal.fiberTarget.toString(), { goal = goal.copy(fiberTarget = it.toIntOrNull() ?: 0) }, numeric = true)
            PersianField("بودجه روزانه (تومان)", goal.dailyBudgetIRR.toString(), { goal = goal.copy(dailyBudgetIRR = it.toIntOrNull() ?: 0) }, numeric = true)
            ErrorText(error)
            if (!message.isNullOrBlank()) {
                Text(message!!, style = TextStyle(fontSize = 14.sp, color = AppColors.Primary))
            }
            AppButton(
                "ذخیره اهداف",
                loading = busy,
                onClick = {
                    scope.launch {
                        busy = true
                        error = null
                        message = null
                        try {
                            val result = api.patch("/api/me/goal", goal.toJson())
                            val updated = AppUser.from(result.getJSONObject("user"))
                            onUserChanged(updated)
                            goal = updated.goal
                            message = "اهداف ذخیره شد."
                        } catch (e: Exception) {
                            error = if (e is ApiException) e.message else "خطا در ذخیره اهداف"
                        } finally {
                            busy = false
                        }
                    }
                },
            )
        }

        AppCard {
            SectionTitle("اشتراک")
            Text(
                "نسخه رایگان شامل ۲۰ غذای ایرانی، ۷ روز تاریخچه و گزارش پایه است.",
                style = SmallStyle,
                modifier = Modifier.padding(bottom = 12.dp),
            )
            if (user.plan != "pro") {
                AppButton(
                    "ارتقا به حرفهای",
                    variant = ButtonVariant.Accent,
                    loading = busy,
                    onClick = {
                        scope.launch {
                            busy = true
                            try {
                                val result = api.post("/api/upgrade", JSONObject().put("plan", "pro"))
                                onUserChanged(AppUser.from(result.getJSONObject("user")))
                                message = "نسخه حرفهای فعال شد (پرداخت آزمایشی)."
                            } catch (e: Exception) {
                                error = if (e is ApiException) e.message else "خطا در ارتقا"
                            } finally {
                                busy = false
                            }
                        }
                    },
                )
            }
        }

        AppButton("خروج از حساب", variant = ButtonVariant.Secondary, onClick = onSignOut)
    }
}

@Composable
fun SuggestionsScreen(api: ApiClient) {
    var meals by remember { mutableStateOf<List<MealEntry>>(emptyList()) }
    var foods by remember { mutableStateOf<List<Food>>(emptyList()) }
    var suggestions by remember { mutableStateOf<List<Suggestion>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var calculating by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        api.track("page.viewed", JSONObject().put("page", "suggestions"))
        try {
            val response = api.get("/api/meals")
            meals = MealEntry.list(response.optJSONArray("meals"))
            foods = Food.list(response.optJSONArray("foods"))
        } catch (e: Exception) {
            error = ApiClient.message(e)
        } finally {
            loading = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
    ) {
        Text("پیشنهادها", style = TitleStyle)
        Text(
            "برای هر وعده ثبتشده، جایگزین متعادل و اقتصادی ببینید.",
            style = SmallStyle,
            modifier = Modifier.padding(bottom = 16.dp),
        )
        ErrorText(error)

        AppCard {
            SectionTitle("وعدههای ثبتشده")
            if (loading) LoadingText()
            else if (meals.isEmpty()) EmptyText("ابتدا یک وعده ثبت کنید.")
            else {
                val names = foods.associateBy { it.id }
                meals.forEach { meal ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                scope.launch {
                                    calculating = true
                                    error = null
                                    try {
                                        val response = api.get("/api/recommendations/${meal.id}")
                                        suggestions = Suggestion.list(response.optJSONArray("suggestions"))
                                    } catch (e: Exception) {
                                        error = ApiClient.message(e)
                                    } finally {
                                        calculating = false
                                    }
                                }
                            }
                            .padding(vertical = 12.dp),
                    ) {
                        Text(
                            names[meal.foodId]?.nameFa ?: meal.foodId,
                            style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold),
                        )
                        Text("${meal.date} · ${faNumber(meal.grams)} گرم", style = SmallStyle)
                    }
                }
            }
        }

        AppCard {
            SectionTitle("نتیجه")
            if (calculating) LoadingText("در حال محاسبه…")
            else if (suggestions.isEmpty()) EmptyText("جایگزین مناسبی پیدا نشد.")
            else suggestions.forEach { s ->
                Text(s.titleFa, style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold))
                Text(s.reasonFa, style = SmallStyle, modifier = Modifier.padding(bottom = 8.dp))
            }
            Text(
                "اعداد توسط موتور محاسبه بشقاب‌یار بهدست آمدهاند.",
                style = TextStyle(fontSize = 12.sp, color = AppColors.TextSecondary, textAlign = TextAlign.Start),
                modifier = Modifier.padding(top = 12.dp),
            )
        }
    }
}
