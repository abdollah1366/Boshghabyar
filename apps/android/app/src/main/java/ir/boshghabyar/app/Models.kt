package ir.boshghabyar.app

import org.json.JSONArray
import org.json.JSONObject

/** مقدار رشته‌ای یا null (org.json برای JSON null مقدار NULL برمی‌گرداند) */
private fun JSONObject.str(key: String): String? =
    if (isNull(key)) null else optString(key, "").takeIf { it.isNotEmpty() }

private fun JSONObject.int(key: String, fallback: Int = 0): Int = optInt(key, fallback)
private fun JSONObject.dbl(key: String, fallback: Double = 0.0): Double = optDouble(key, fallback)

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

data class LevelInfo(val id: String, val labelFa: String) {
    companion object {
        fun from(o: JSONObject?): LevelInfo = LevelInfo(
            id = o?.optString("id", "bronze") ?: "bronze",
            labelFa = o?.optString("labelFa", "برنزی") ?: "برنزی",
        )
    }
}

data class AppUser(
    val id: String,
    val name: String,
    val email: String?,
    val phone: String?,
    val role: String,
    val plan: String,
    val proUntil: String?,
    val goal: UserGoal,
    val referralCode: String?,
    val tokenBalance: Int,
    val level: LevelInfo,
    val researchConsent: Boolean,
) {
    val isPro: Boolean get() = plan == "pro"

    companion object {
        fun from(o: JSONObject): AppUser = AppUser(
            id = o.optString("id"),
            name = o.optString("name", "کاربر"),
            email = o.str("email"),
            phone = o.str("phone"),
            role = o.optString("role", "user"),
            plan = o.optString("plan", "free"),
            proUntil = o.str("proUntil"),
            goal = UserGoal.from(o.optJSONObject("goal")),
            referralCode = o.str("referralCode"),
            tokenBalance = o.optInt("tokenBalance"),
            level = LevelInfo.from(o.optJSONObject("level")),
            researchConsent = o.optBoolean("researchConsent"),
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
    val free: Boolean,
) {
    companion object {
        fun from(o: JSONObject): Food {
            val serving = o.optJSONObject("serving")
            return Food(
                id = o.optString("id"),
                nameFa = o.optString("nameFa", "غذا"),
                category = o.optString("category"),
                per100g = Macros.from(o.optJSONObject("per100g")),
                servingGrams = serving?.optInt("grams") ?: 100,
                servingLabelFa = serving?.optString("labelFa", "") ?: "",
                estimatedPriceIRR = o.optInt("estimatedPriceIRR"),
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
    val status: String,
) {
    companion object {
        fun from(o: JSONObject): DayReport = DayReport(
            totals = Macros.from(o.optJSONObject("totals")),
            goal = UserGoal.from(o.optJSONObject("goal")),
            budgetRatio = o.optJSONObject("ratio")?.optDouble("budget", 0.0) ?: 0.0,
            entryCount = o.optInt("entryCount"),
            status = o.optString("status", "balanced"),
        )
    }
}

data class TrendPoint(
    val date: String,
    val kcal: Int,
    val protein: Double = 0.0,
    val budget: Double = 0.0,
    val entryCount: Int = 0,
)

data class WeeklyReport(
    val trend: List<TrendPoint>,
    val averageKcal: Double,
    val averageProtein: Double,
    val activeDays: Int,
    val totalMeals: Int,
    val budgetUsedIRR: Double,
    val insight: String,
    val advanced: Boolean,
) {
    companion object {
        fun from(o: JSONObject): WeeklyReport {
            val points = mutableListOf<TrendPoint>()
            o.optJSONArray("trend")?.let { arr ->
                for (i in 0 until arr.length()) {
                    val p = arr.optJSONObject(i)
                    points.add(
                        TrendPoint(
                            date = p.optString("date"),
                            kcal = p.optInt("kcal"),
                            protein = p.optDouble("protein"),
                            budget = p.optDouble("budget"),
                            entryCount = p.optInt("entryCount"),
                        )
                    )
                }
            }
            val summary = o.optJSONObject("summary")
            return WeeklyReport(
                trend = points,
                averageKcal = summary?.optDouble("averageKcal", 0.0) ?: 0.0,
                averageProtein = summary?.optDouble("averageProtein", 0.0) ?: 0.0,
                activeDays = summary?.optInt("activeDays", 0) ?: 0,
                totalMeals = summary?.optInt("totalMeals", 0) ?: 0,
                budgetUsedIRR = summary?.optDouble("budgetUsedIRR", 0.0) ?: 0.0,
                insight = o.optString("insight"),
                advanced = o.optBoolean("advanced"),
            )
        }
    }
}

data class DetailedPoint(
    val date: String,
    val kcal: Int,
    val protein: Double,
    val carbs: Double,
    val fat: Double,
    val fiber: Double,
    val budget: Double,
    val entryCount: Int,
)

data class DetailedReport(
    val from: String,
    val to: String,
    val days: Int,
    val activeDays: Int,
    val totalMeals: Int,
    val trend: List<DetailedPoint>,
    val averages: Macros,
    val macroSplitProtein: Int,
    val macroSplitCarbs: Int,
    val macroSplitFat: Int,
    val adherenceKcalPct: Int,
    val adherenceProteinPct: Int,
    val adherenceBudgetPct: Int,
    val mealTypes: List<MealTypeStat>,
    val topFoods: List<TopFoodStat>,
    val longestStreak: Int,
    val score: Int,
    val insights: List<String>,
) {
    companion object {
        fun from(o: JSONObject): DetailedReport {
            val trend = mutableListOf<DetailedPoint>()
            o.optJSONArray("trend")?.let { arr ->
                for (i in 0 until arr.length()) {
                    val p = arr.optJSONObject(i)
                    trend.add(
                        DetailedPoint(
                            date = p.optString("date"),
                            kcal = p.optInt("kcal"),
                            protein = p.optDouble("protein"),
                            carbs = p.optDouble("carbs"),
                            fat = p.optDouble("fat"),
                            fiber = p.optDouble("fiber"),
                            budget = p.optDouble("budget"),
                            entryCount = p.optInt("entryCount"),
                        )
                    )
                }
            }
            val split = o.optJSONObject("macroSplit")
            val adherence = o.optJSONObject("adherence")
            val mealTypes = mutableListOf<MealTypeStat>()
            o.optJSONArray("mealTypes")?.let { arr ->
                for (i in 0 until arr.length()) mealTypes.add(MealTypeStat.from(arr.optJSONObject(i)))
            }
            val topFoods = mutableListOf<TopFoodStat>()
            o.optJSONArray("topFoods")?.let { arr ->
                for (i in 0 until arr.length()) topFoods.add(TopFoodStat.from(arr.optJSONObject(i)))
            }
            val insights = mutableListOf<String>()
            o.optJSONArray("insights")?.let { arr ->
                for (i in 0 until arr.length()) insights.add(arr.optString(i))
            }
            return DetailedReport(
                from = o.optString("from"),
                to = o.optString("to"),
                days = o.optInt("days"),
                activeDays = o.optInt("activeDays"),
                totalMeals = o.optInt("totalMeals"),
                trend = trend,
                averages = Macros.from(o.optJSONObject("averages")),
                macroSplitProtein = split?.optInt("proteinPct") ?: 0,
                macroSplitCarbs = split?.optInt("carbsPct") ?: 0,
                macroSplitFat = split?.optInt("fatPct") ?: 0,
                adherenceKcalPct = adherence?.optInt("kcalPct") ?: 0,
                adherenceProteinPct = adherence?.optInt("proteinPct") ?: 0,
                adherenceBudgetPct = adherence?.optInt("budgetPct") ?: 0,
                mealTypes = mealTypes,
                topFoods = topFoods,
                longestStreak = o.optInt("longestStreak"),
                score = o.optInt("score"),
                insights = insights,
            )
        }
    }
}

data class MealTypeStat(val labelFa: String, val count: Int, val kcal: Int, val sharePct: Int) {
    companion object {
        fun from(o: JSONObject) = MealTypeStat(
            labelFa = o.optString("labelFa"),
            count = o.optInt("count"),
            kcal = o.optInt("kcal"),
            sharePct = o.optInt("sharePct"),
        )
    }
}

data class TopFoodStat(val nameFa: String, val count: Int, val grams: Int, val kcal: Int) {
    companion object {
        fun from(o: JSONObject) = TopFoodStat(
            nameFa = o.optString("nameFa"),
            count = o.optInt("count"),
            grams = o.optInt("grams"),
            kcal = o.optInt("kcal"),
        )
    }
}

data class RecognizeAlternative(val foodId: String, val foodNameFa: String, val confidence: Double)

data class RecognizeDetection(
    val foodId: String,
    val foodNameFa: String,
    val confidence: Double,
    val suggestedGrams: Int,
    val alternatives: List<RecognizeAlternative>,
)

data class RecognizeResult(
    val detection: RecognizeDetection?,
    val remaining: Int,
    val provider: String,
    val demo: Boolean,
    val messageFa: String?,
) {
    companion object {
        fun from(o: JSONObject): RecognizeResult {
            val d = o.optJSONObject("detection")
            val detection = if (d != null && !o.isNull("detection")) {
                val alts = mutableListOf<RecognizeAlternative>()
                d.optJSONArray("alternatives")?.let { arr ->
                    for (i in 0 until arr.length()) {
                        val a = arr.optJSONObject(i)
                        alts.add(
                            RecognizeAlternative(
                                foodId = a.optString("foodId"),
                                foodNameFa = a.optString("foodNameFa"),
                                confidence = a.optDouble("confidence"),
                            )
                        )
                    }
                }
                RecognizeDetection(
                    foodId = d.optString("foodId"),
                    foodNameFa = d.optString("foodNameFa"),
                    confidence = d.optDouble("confidence"),
                    suggestedGrams = d.optInt("suggestedGrams"),
                    alternatives = alts,
                )
            } else null
            return RecognizeResult(
                detection = detection,
                remaining = o.optInt("remaining"),
                provider = o.optString("provider"),
                demo = o.optBoolean("demo"),
                messageFa = o.str("messageFa"),
            )
        }
    }
}

data class RecognizeStatus(val available: Boolean, val provider: String?, val limit: Int, val used: Int) {
    companion object {
        fun from(o: JSONObject) = RecognizeStatus(
            available = o.optBoolean("available"),
            provider = o.str("provider"),
            limit = o.optInt("limit"),
            used = o.optInt("used"),
        )
    }
}

data class Reward(val id: String, val titleFa: String, val descriptionFa: String, val costTokens: Int, val proDays: Int) {
    companion object {
        fun from(o: JSONObject) = Reward(
            id = o.optString("id"),
            titleFa = o.optString("titleFa"),
            descriptionFa = o.optString("descriptionFa"),
            costTokens = o.optInt("costTokens"),
            proDays = o.optInt("proDays"),
        )

        fun list(arr: JSONArray?): List<Reward> {
            val result = mutableListOf<Reward>()
            arr?.let { for (i in 0 until it.length()) result.add(from(it.optJSONObject(i))) }
            return result
        }
    }
}

data class InvitedFriend(val name: String, val phone: String?, val status: String, val createdAt: String)

data class LedgerEntry(val delta: Int, val reason: String, val balanceAfter: Int, val createdAt: String)

data class ClubState(
    val balance: Int,
    val tokensEarned: Int,
    val levelId: String,
    val levelLabelFa: String,
    val nextLevelLabelFa: String?,
    val levelRemaining: Int,
    val levelProgressPct: Int,
    val streak: Int,
    val checkedInToday: Boolean,
    val referralCode: String?,
    val referralInvitee: Int,
    val referralInviter: Int,
    val invited: List<InvitedFriend>,
    val invitedCount: Int,
    val rewardedCount: Int,
    val rewards: List<Reward>,
    val ledger: List<LedgerEntry>,
    val proUntil: String?,
) {
    companion object {
        fun from(o: JSONObject): ClubState {
            val level = o.optJSONObject("level")
            val next = level?.optJSONObject("next")
            val refRewards = o.optJSONObject("referralRewards")
            val invited = mutableListOf<InvitedFriend>()
            o.optJSONArray("invited")?.let { arr ->
                for (i in 0 until arr.length()) {
                    val f = arr.optJSONObject(i)
                    invited.add(
                        InvitedFriend(
                            name = f.optString("name"),
                            phone = f.str("phone"),
                            status = f.optString("status"),
                            createdAt = f.optString("createdAt"),
                        )
                    )
                }
            }
            val ledger = mutableListOf<LedgerEntry>()
            o.optJSONArray("ledger")?.let { arr ->
                for (i in 0 until arr.length()) {
                    val e = arr.optJSONObject(i)
                    ledger.add(
                        LedgerEntry(
                            delta = e.optInt("delta"),
                            reason = e.optString("reason"),
                            balanceAfter = e.optInt("balance_after"),
                            createdAt = e.optString("created_at"),
                        )
                    )
                }
            }
            return ClubState(
                balance = o.optInt("balance"),
                tokensEarned = o.optInt("tokensEarned"),
                levelId = level?.optString("id", "bronze") ?: "bronze",
                levelLabelFa = level?.optString("labelFa", "برنزی") ?: "برنزی",
                nextLevelLabelFa = if (next != null && !o.isNull("level")) next.optString("labelFa", "").ifEmpty { null } else null,
                levelRemaining = level?.optInt("remaining") ?: 0,
                levelProgressPct = level?.optInt("progressPct") ?: 0,
                streak = o.optInt("streak"),
                checkedInToday = o.optBoolean("checkedInToday"),
                referralCode = o.str("referralCode"),
                referralInvitee = refRewards?.optInt("invitee") ?: 0,
                referralInviter = refRewards?.optInt("inviter") ?: 0,
                invited = invited,
                invitedCount = o.optInt("invitedCount"),
                rewardedCount = o.optInt("rewardedCount"),
                rewards = Reward.list(o.optJSONArray("rewards")),
                ledger = ledger,
                proUntil = o.str("proUntil"),
            )
        }
    }
}

data class CheckinResult(
    val awarded: Int,
    val alreadyDone: Boolean,
    val streak: Int,
    val bonus: Int,
    val balance: Int,
) {
    companion object {
        fun from(o: JSONObject) = CheckinResult(
            awarded = o.optInt("awarded"),
            alreadyDone = o.optBoolean("alreadyDone"),
            streak = o.optInt("streak"),
            bonus = o.optInt("bonus"),
            balance = o.optInt("balance"),
        )
    }
}

val MEAL_LABELS = mapOf(
    "breakfast" to "صبحانه",
    "lunch" to "ناهار",
    "dinner" to "شام",
    "snack" to "میان‌وعده",
)

val GOAL_LABELS = listOf(
    "balance" to "تعادل",
    "weight-loss" to "کاهش وزن",
    "muscle-gain" to "افزایش عضله",
    "budget" to "صرفه‌جویی",
)

val LEDGER_REASON_LABELS = mapOf(
    "welcome" to "هدیهٔ خوش‌آمد",
    "checkin" to "حضور روزانه",
    "meal-day" to "ثبت وعده",
    "referral-inviter" to "معرفی دوست",
    "referral-invitee" to "عضویت با کد معرف",
    "streak-bonus" to "پاداش زنجیره",
    "redeem" to "استفاده از جایزه",
    "research-consent" to "مشارکت پژوهشی",
    "admin-grant" to "هدیهٔ مدیر",
    "demo-topup" to "شارژ آزمایشی",
    "food-contribution" to "ثبت محصول با بارکد",
)

// ---------- برنامهٔ غذایی ----------

data class RecipeIngredient(val name: String, val amount: String)

data class Recipe(
    val id: String,
    val titleFa: String,
    val mealType: String,
    val kcal: Int,
    val protein: Int,
    val servings: Int,
    val priceIRRPerServing: Int,
    val minutes: Int,
    val difficulty: String,
    val ingredients: List<RecipeIngredient>,
    val steps: List<String>,
    val tags: List<String>,
) {
    companion object {
        fun from(o: JSONObject): Recipe {
            val perServing = o.optJSONObject("perServing")
            val ingredients = mutableListOf<RecipeIngredient>()
            o.optJSONArray("ingredients")?.let { arr ->
                for (i in 0 until arr.length()) {
                    val ing = arr.optJSONObject(i)
                    ingredients.add(RecipeIngredient(ing.optString("name"), ing.optString("amount")))
                }
            }
            val steps = mutableListOf<String>()
            o.optJSONArray("steps")?.let { arr -> for (i in 0 until arr.length()) steps.add(arr.optString(i)) }
            val tags = mutableListOf<String>()
            o.optJSONArray("tags")?.let { arr -> for (i in 0 until arr.length()) tags.add(arr.optString(i)) }
            return Recipe(
                id = o.optString("id"),
                titleFa = o.optString("titleFa"),
                mealType = o.optString("mealType"),
                kcal = perServing?.optInt("kcal") ?: 0,
                protein = perServing?.optInt("protein") ?: 0,
                servings = o.optInt("servings", 1),
                priceIRRPerServing = o.optInt("priceIRRPerServing"),
                minutes = o.optInt("minutes"),
                difficulty = o.optString("difficulty", "آسان"),
                ingredients = ingredients,
                steps = steps,
                tags = tags,
            )
        }
    }
}

data class PlannedMeal(val mealType: String, val recipe: Recipe)

data class MealPlanDay(
    val weekdayFa: String,
    val meals: List<PlannedMeal>,
    val totalKcal: Int,
    val totalProtein: Int,
    val totalPriceIRR: Int,
)

data class MealPlan(val days: List<MealPlanDay>, val averageKcal: Int, val averagePriceIRR: Int) {
    companion object {
        fun from(o: JSONObject): MealPlan {
            val days = mutableListOf<MealPlanDay>()
            o.optJSONArray("days")?.let { arr ->
                for (i in 0 until arr.length()) {
                    val d = arr.optJSONObject(i)
                    val meals = mutableListOf<PlannedMeal>()
                    d.optJSONArray("meals")?.let { ma ->
                        for (j in 0 until ma.length()) {
                            val m = ma.optJSONObject(j)
                            meals.add(PlannedMeal(m.optString("mealType"), Recipe.from(m.optJSONObject("recipe"))))
                        }
                    }
                    days.add(
                        MealPlanDay(
                            weekdayFa = d.optString("weekdayFa"),
                            meals = meals,
                            totalKcal = d.optInt("totalKcal"),
                            totalProtein = d.optInt("totalProtein"),
                            totalPriceIRR = d.optInt("totalPriceIRR"),
                        )
                    )
                }
            }
            return MealPlan(days = days, averageKcal = o.optInt("averageKcal"), averagePriceIRR = o.optInt("averagePriceIRR"))
        }
    }
}
