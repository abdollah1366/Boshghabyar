package ir.boshghabyar.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val typography = Typography(
                headlineLarge = TextStyle(fontFamily = VazirmatnFont, fontWeight = FontWeight.Bold, fontSize = 30.sp),
                headlineMedium = TextStyle(fontFamily = VazirmatnFont, fontWeight = FontWeight.Bold, fontSize = 24.sp),
                headlineSmall = TextStyle(fontFamily = VazirmatnFont, fontWeight = FontWeight.Bold, fontSize = 20.sp),
                titleLarge = TextStyle(fontFamily = VazirmatnFont, fontWeight = FontWeight.Bold, fontSize = 18.sp),
                titleMedium = TextStyle(fontFamily = VazirmatnFont, fontWeight = FontWeight.Bold, fontSize = 16.sp),
                titleSmall = TextStyle(fontFamily = VazirmatnFont, fontWeight = FontWeight.Bold, fontSize = 14.sp),
                bodyLarge = TextStyle(fontFamily = VazirmatnFont, fontSize = 16.sp),
                bodyMedium = TextStyle(fontFamily = VazirmatnFont, fontSize = 14.sp),
                bodySmall = TextStyle(fontFamily = VazirmatnFont, fontSize = 12.sp),
                labelLarge = TextStyle(fontFamily = VazirmatnFont, fontSize = 14.sp),
                labelMedium = TextStyle(fontFamily = VazirmatnFont, fontSize = 12.sp),
                labelSmall = TextStyle(fontFamily = VazirmatnFont, fontSize = 10.sp),
            )
            MaterialTheme(colorScheme = if (isSystemInDarkTheme()) DarkScheme else LightScheme, typography = typography) {
                BoshghabYarApp(AppState(ApiClient(), SessionStore(this)))
            }
        }
    }
}
