package ir.boshghabyar.app

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import kotlinx.coroutines.launch

private data class TabItem(val route: String, val label: String, val icon: ImageVector)

private val TABS = listOf(
    TabItem("home", "خانه", Icons.Filled.Home),
    TabItem("log", "ثبت وعده", Icons.Filled.AddCircle),
    TabItem("mealplan", "برنامه", Icons.Filled.CalendarMonth),
    TabItem("reports", "گزارش", Icons.Filled.BarChart),
    TabItem("club", "باشگاه", Icons.Filled.CardGiftcard),
    TabItem("profile", "نمایه", Icons.Filled.Person),
)

private fun NavHostController.navigateToTab(route: String) {
    navigate(route) {
        popUpTo("home") { inclusive = false }
        launchSingleTop = true
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MainScaffold(app: AppState, navController: NavHostController, content: @Composable () -> Unit) {
    val route = navController.currentBackStackEntryAsState().value?.destination?.route?.substringBefore('?')
    val user = app.user
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(app.snackbar) },
        topBar = {
            TopAppBar(
                title = { Text("بشقاب‌یار", fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, color = MaterialTheme.colorScheme.primary, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                actions = {
                    if (user != null) {
                        PlanBadge(user.isPro)
                        TokenChip(user.tokenBalance) { navController.navigateToTab("club") }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                TABS.forEach { tab ->
                    NavigationBarItem(
                        selected = route == tab.route,
                        onClick = { navController.navigateToTab(tab.route) },
                        icon = { Icon(tab.icon, contentDescription = tab.label) },
                        label = { Text(tab.label, style = MaterialTheme.typography.labelSmall, maxLines = 1) },
                    )
                }
            }
        },
    ) { inner ->
        Box(Modifier.fillMaxSize().padding(inner)) { content() }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DetailScaffold(app: AppState, title: String, onBack: () -> Unit, content: @Composable () -> Unit) {
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(app.snackbar) },
        topBar = {
            TopAppBar(
                title = { Text(title) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "بازگشت") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { inner ->
        Box(Modifier.fillMaxSize().padding(inner)) { content() }
    }
}

@Composable
fun BoshghabYarApp(app: AppState) {
    val navController = rememberNavController()
    val scope = rememberCoroutineScope()
    var loading by remember { mutableStateOf(true) }
    var startupError by remember { mutableStateOf<String?>(null) }
    var attempt by remember { mutableStateOf(0) }

    fun clearSession() {
        app.store.clear()
        app.api.token = null
        app.user = null
        navController.navigate("login") { popUpTo(0) { inclusive = true } }
    }

    fun logout() {
        scope.launch {
            runCatching { app.api.post("/api/auth/logout") }
            clearSession()
        }
    }

    fun onAuthenticated(user: AppUser, isNew: Boolean) {
        app.user = user
        navController.navigate("home") { popUpTo(0) { inclusive = true } }
        if (isNew) app.notify(scope, "خوش آمدید! ژتون هدیه به حساب شما اضافه شد")
    }

    LaunchedEffect(attempt) {
        loading = true
        startupError = null
        val token = app.store.token
        if (token != null) {
            app.api.token = token
            apiResult { app.api.me() }
                .onSuccess { app.user = it }
                .onFailure { e ->
                    if (e is ApiException && e.status == 0) {
                        startupError = ApiClient.message(e)
                        return@LaunchedEffect
                    }
                    app.store.clear()
                    app.api.token = null
                }
        }
        app.api.onUnauthorized = { clearSession() }
        loading = false
    }

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        if (loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            return@CompositionLocalProvider
        }
        if (startupError != null) {
            Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    ErrorText(startupError)
                    AppButton("تلاش دوباره", onClick = { attempt = attempt + 1 })
                }
            }
            return@CompositionLocalProvider
        }
        NavHost(
            navController = navController,
            startDestination = if (app.user != null) "home" else "login",
        ) {
            composable("login") { LoginScreen(app, ::onAuthenticated) }
            composable("home") {
                MainScaffold(app, navController) {
                    HomeScreen(
                        app,
                        onNavigate = { navController.navigateToTab(it) },
                        onOpenCamera = { navController.navigate("log?camera=true") { launchSingleTop = true } },
                        onOpenSuggestions = { navController.navigate("suggestions") },
                        onOpenQuiz = { navController.navigate("quiz") },
                        onOpenLeaderboard = { navController.navigate("leaderboard") },
                    )
                }
            }
            composable(
                route = "log?camera={camera}",
                arguments = listOf(navArgument("camera") { type = NavType.BoolType; defaultValue = false }),
            ) { entry ->
                MainScaffold(app, navController) {
                    LogScreen(app, autoCamera = entry.arguments?.getBoolean("camera") == true, onOpenSuggestions = { navController.navigate("suggestions") }, onOpenScanFood = { navController.navigate("scanfood") })
                }
            }
            composable("reports") {
                MainScaffold(app, navController) { ReportsScreen(app, onOpenClub = { navController.navigateToTab("club") }) }
            }
            composable("mealplan") {
                MainScaffold(app, navController) { MealPlanScreen(app) }
            }
            composable("scanfood") {
                DetailScaffold(app, "افزودن محصول با بارکد", onBack = { navController.popBackStack() }) { ScanFoodScreen(app) }
            }
            composable("club") {
                MainScaffold(app, navController) { ClubScreen(app) }
            }
            composable("profile") {
                MainScaffold(app, navController) { ProfileScreen(app, ::logout, ::clearSession, onOpenHealth = { navController.navigate("health") }) }
            }
            composable("health") {
                DetailScaffold(app, "شاخص‌های سلامتی", onBack = { navController.popBackStack() }) { HealthScreen(app) }
            }
            composable("quiz") {
                DetailScaffold(app, "مسابقهٔ روزانه", onBack = { navController.popBackStack() }) { QuizScreen(app) }
            }
            composable("leaderboard") {
                DetailScaffold(app, "برترین‌ها", onBack = { navController.popBackStack() }) { LeaderboardScreen(app) }
            }
            composable("suggestions") {
                DetailScaffold(app, "پیشنهادها", onBack = { navController.popBackStack() }) { SuggestionsScreen(app) }
            }
        }
    }
}

