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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.json.JSONObject

@Composable
fun MealPlanScreen(app: AppState) {
    val api = app.api
    var plan by remember { mutableStateOf<MealPlan?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var expanded by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        apiResult { MealPlan.from(api.get("/api/mealplan?days=7").optJSONObject("plan")) }
            .onSuccess { plan = it }
            .onFailure { error = ApiClient.message(it) }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        ScreenHeader("برنامهٔ غذایی هفتگی", "غذای هر روز با انرژی و هزینهٔ تقریبی")
        ErrorText(error)
        val p = plan
        if (p == null) {
            if (error == null) LoadingText()
        } else {
            AppCard {
                MetricRow(
                    { Metric("میانگین انرژی روزانه", faNumber(p.averageKcal), "کیلوکالری") },
                    { Metric("میانگین هزینهٔ روزانه", faMoney(p.averagePriceIRR), "تومان") },
                )
            }
            p.days.forEach { day ->
                AppCard {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                        Text(day.weekdayFa, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                        Text("${faNumber(day.totalKcal)} کیلوکالری · ${faMoney(day.totalPriceIRR)} تومان", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    HorizontalDivider(color = AppColors.Border.copy(alpha = 0.5f), modifier = Modifier.padding(vertical = 8.dp))
                    day.meals.forEach { meal ->
                        val recipe = meal.recipe
                        val open = expanded == recipe.id
                        Surface(
                            onClick = { expanded = if (open) null else recipe.id },
                            color = MaterialTheme.colorScheme.surface,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                        ) {
                            Column(Modifier.padding(10.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Badge(MEAL_LABELS[meal.mealType] ?: meal.mealType, MaterialTheme.colorScheme.primaryContainer, MaterialTheme.colorScheme.onPrimaryContainer)
                                    Text(recipe.titleFa, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                                    Text("${faNumber(recipe.kcal)} کیلوکالری", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(top = 4.dp)) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                        Icon(Icons.Filled.Schedule, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
                                        Text("${faNumber(recipe.minutes)} دقیقه", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                    Text("${faMoney(recipe.priceIRRPerServing)} تومان", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    Text(recipe.difficulty, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                if (open) {
                                    HorizontalDivider(color = AppColors.Border.copy(alpha = 0.4f), modifier = Modifier.padding(vertical = 8.dp))
                                    Text("مواد لازم:", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                                    recipe.ingredients.forEach { ing ->
                                        Text("• ${ing.name} — ${ing.amount}", style = MaterialTheme.typography.bodySmall)
                                    }
                                    Spacer(Modifier.height(6.dp))
                                    Text("طرز تهیه:", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                                    recipe.steps.forEachIndexed { i, step ->
                                        Text("${faNumber(i + 1)}. $step", style = MaterialTheme.typography.bodySmall)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Text("انرژی و قیمت‌ها تخمینی‌اند و جایگزین مشاورهٔ تغذیه نیستند.", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
