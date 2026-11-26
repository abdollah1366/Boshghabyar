package ir.boshghabyar.app

import org.json.JSONArray
import org.json.JSONObject

data class Macros(
    val kcal: Int = 0,
    val protein: Int = 0,
    val carbs: Int = 0,
    val fat: Int = 0,
    val fiber: Int = 0,
) {
    companion object {
        fun from(o: JSONObject?): Macros = o?.let {
            Macros(
                kcal = it.optInt("kcal"),
                protein = it.optInt("protein"),
                carbs = it.optInt("carbs"),
                fat = it.optInt("fat"),
                fiber = it.optInt("fiber"),
            )
        } ?: Macros()
    }
}

data class UserGoal(
    val calorieTarget: Int = 2000,
    val proteinTarget: Int = 100,
    val carbsTarget: Int = 260,
    val fatTarget: Int = 65,
    val fiberTarget: Int = 25,
    val dailyBudgetIRR: Int = 250000,
    val goalType: String = "balance",
) {
    fun toJson(): JSONObject = JSONObject()
        .put("calorieTarget", calorieTarget)
        .put("proteinTarget", proteinTarget)
        .put("carbsTarget", carbsTarget)
        .put("fatTarget", fatTarget)
        .put("fiberTarget", fiberTarget)
        .put("dailyBudgetIRR", dailyBudgetIRR)
        .put("goalType", goalType)

    companion object {
        fun from(o: JSONObject?): UserGoal = o?.let {
            UserGoal(
                calorieTarget = it.optInt("calorieTarget", 2000),
                proteinTarget = it.optInt("proteinTarget", 100),
                carbsTarget = it.optInt("carbsTarget", 260),
                fatTarget = it.optInt("fatTarget", 65),
                fiberTarget = it.optInt("fiberTarget", 25),
                dailyBudgetIRR = it.optInt("dailyBudgetIRR", 250000),
                goalType = it.optString("goalType", "balance"),
            )
        } ?: UserGoal()
    }
}

data class AppUser(
    val id: String,
    val name: String,
    val email: String,
    val role: String,
    val plan: String,
    val goal: UserGoal,
) {
    companion object {
        fun from(o: JSONObject): AppUser = AppUser(
            id = o.optString("id"),
            name = o.optString("name", "کاربر"),
            email = o.optString("email"),
            role = o.optString("role", "user"),
            plan = o.optString("plan", "free"),
            goal = UserGoal.from(o.optJSONObject("goal")),
        )
    }
}

data class Food(
    val id: String,
    val nameFa: String,
    val category: String,
    val per100g: Macros,
    val servingGrams: Int,
    val servingLabelFa: String,
    val estimatedPriceIRR: Int,
    val tags: List<String>,
    val free: Boolean,
) {
    companion object {
        fun from(o: JSONObject): Food {
            val serving = o.optJSONObject("serving")
            val tags = mutableListOf<String>()
            o.optJSONArray("tags")?.let { arr ->
                for (i in 0 until arr.length()) tags.add(arr.optString(i))
            }
            return Food(
                id = o.optString("id"),
                nameFa = o.optString("nameFa", "غذا"),
                category = o.optString("category"),
                per100g = Macros.from(o.optJSONObject("per100g")),
                servingGrams = serving?.optInt("grams") ?: 100,
                servingLabelFa = serving?.optString("labelFa", "") ?: "",
                estimatedPriceIRR = o.optInt("estimatedPriceIRR"),
                tags = tags,
                free = o.optBoolean("free"),
            )
        }

        fun list(arr: JSONArray?): List<Food> {
            val result = mutableListOf<Food>()
            arr?.let { for (i in 0 until it.length()) result.add(from(it.optJSONObject(i))) }
            return result
        }
    }
}

data class MealEntry(
    val id: String,
    val foodId: String,
    val grams: Int,
    val mealType: String,
    val date: String,
    val createdAt: String = "",
) {
    companion object {
        fun from(o: JSONObject) = MealEntry(
            id = o.optString("id"),
            foodId = o.optString("foodId"),
            grams = o.optInt("grams"),
            mealType = o.optString("mealType", "lunch"),
            date = o.optString("date"),
            createdAt = o.optString("createdAt"),
        )

        fun list(arr: JSONArray?): List<MealEntry> {
            val result = mutableListOf<MealEntry>()
            arr?.let { for (i in 0 until it.length()) result.add(from(it.optJSONObject(i))) }
            return result
        }
    }
}

data class Suggestion(
    val kind: String,
    val titleFa: String,
    val reasonFa: String,
    val toFoodId: String,
) {
    companion object {
        fun list(arr: JSONArray?): List<Suggestion> {
            val result = mutableListOf<Suggestion>()
            arr?.let {
                for (i in 0 until it.length()) {
                    val o = it.optJSONObject(i)
                    result.add(
                        Suggestion(
                            kind = o.optString("kind"),
                            titleFa = o.optString("titleFa"),
                            reasonFa = o.optString("reasonFa"),
                            toFoodId = o.optString("toFoodId"),
                        )
                    )
                }
            }
            return result
        }
    }
}

data class DayReport(
    val totals: Macros,
    val goal: UserGoal,
    val budgetRatio: Double,
    val entryCount: Int,
) {
    companion object {
        fun from(o: JSONObject): DayReport = DayReport(
            totals = Macros.from(o.optJSONObject("totals")),
            goal = UserGoal.from(o.optJSONObject("goal")),
            budgetRatio = o.optJSONObject("ratio")?.optDouble("budget", 0.0) ?: 0.0,
            entryCount = o.optInt("entryCount"),
        )
    }
}

data class DailyPoint(val date: String, val kcal: Int)

data class WeeklyReport(
    val trend: List<DailyPoint>,
    val averageKcal: Double,
    val activeDays: Int,
    val insight: String,
    val advanced: Boolean,
) {
    companion object {
        fun from(o: JSONObject): WeeklyReport {
            val points = mutableListOf<DailyPoint>()
            o.optJSONArray("trend")?.let { arr ->
                for (i in 0 until arr.length()) {
                    val p = arr.optJSONObject(i)
                    points.add(DailyPoint(p.optString("date"), p.optInt("kcal")))
                }
            }
            val summary = o.optJSONObject("summary")
            return WeeklyReport(
                trend = points,
                averageKcal = summary?.optDouble("averageKcal", 0.0) ?: 0.0,
                activeDays = summary?.optInt("activeDays", 0) ?: 0,
                insight = o.optString("insight"),
                advanced = o.optBoolean("advanced"),
            )
        }
    }
}

val MEAL_LABELS = mapOf(
    "breakfast" to "صبحانه",
    "lunch" to "ناهار",
    "dinner" to "شام",
    "snack" to "میانوعده",
)

val GOAL_LABELS = listOf(
    "balance" to "تعادل",
    "weight-loss" to "کاهش وزن",
    "muscle-gain" to "افزایش عضله",
    "budget" to "صرفهجویی",
)
