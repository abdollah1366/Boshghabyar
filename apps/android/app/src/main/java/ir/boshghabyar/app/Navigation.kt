package ir.boshghabyar.app

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController

private data class TabItem(val route: String, val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector)

private val TABS = listOf(
    TabItem("home", "خانه", Icons.Filled.Home),
    TabItem("log", "ثبت وعده", Icons.Filled.AddCircle),
    TabItem("reports", "گزارش", Icons.Filled.BarChart),
    TabItem("profile", "نمایه", Icons.Filled.Person),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScaffold(
    navController: NavHostController,
    onSignOut: () -> Unit,
    content: @Composable () -> Unit,
) {
    val currentRoute = navController.currentBackStackEntryAsState().value?.destination?.route
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("بشقاب‌یار") },
                actions = {
                    TextButton(onClick = onSignOut) { Text("خروج") }
                },
            )
        },
        bottomBar = {
            NavigationBar {
                TABS.forEach { tab ->
                    NavigationBarItem(
                        selected = currentRoute == tab.route,
                        onClick = {
                            navController.navigate(tab.route) {
                                popUpTo("home") { inclusive = false }
                                launchSingleTop = true
                            }
                        },
                        icon = { Icon(tab.icon, contentDescription = tab.label) },
                        label = { Text(tab.label) },
                    )
                }
            }
        },
    ) { innerPadding ->
        androidx.compose.foundation.layout.Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            content()
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SuggestionsScaffold(
    navController: NavHostController,
    content: @Composable () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("پیشنهادها") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "بازگشت")
                    }
                },
            )
        },
    ) { innerPadding ->
        androidx.compose.foundation.layout.Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            content()
        }
    }
}

@Composable
fun BoshghabYarApp(api: ApiClient, store: SessionStore) {
    val navController = rememberNavController()
    var user by remember { mutableStateOf<AppUser?>(null) }
    var loading by remember { mutableStateOf(true) }

    fun signOut() {
        store.clear()
        api.token = null
        user = null
        navController.navigate("login") {
            popUpTo(0) { inclusive = true }
        }
    }

    fun onAuthenticated(value: AppUser) {
        user = value
        navController.navigate("home") {
            popUpTo(0) { inclusive = true }
        }
    }

    LaunchedEffect(Unit) {
        val token = store.token
        if (token != null) {
            api.token = token
            try {
                user = api.me()
            } catch (e: Exception) {
                store.clear()
                api.token = null
            }
        }
        loading = false
    }

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        if (loading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                androidx.compose.material3.CircularProgressIndicator()
            }
        } else {
            NavHost(
                navController = navController,
                startDestination = if (user != null) "home" else "login",
            ) {
                composable("login") {
                    LoginScreen(api, store, ::onAuthenticated)
                }
                composable("home") {
                    user?.let { current ->
                        MainScaffold(navController, ::signOut) {
                            HomeScreen(api, current) { route -> navController.navigate(route) }
                        }
                    }
                }
                composable("log") {
                    user?.let {
                        MainScaffold(navController, ::signOut) { LogScreen(api) }
                    }
                }
                composable("reports") {
                    user?.let { current ->
                        MainScaffold(navController, ::signOut) {
                            ReportsScreen(api, current) { user = it }
                        }
                    }
                }
                composable("profile") {
                    user?.let { current ->
                        MainScaffold(navController, ::signOut) {
                            ProfileScreen(api, current, { user = it }, ::signOut)
                        }
                    }
                }
                composable("suggestions") {
                    SuggestionsScaffold(navController) { SuggestionsScreen(api) }
                }
            }
        }
    }
}
