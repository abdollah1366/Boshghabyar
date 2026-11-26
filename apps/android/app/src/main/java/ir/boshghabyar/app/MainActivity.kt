package ir.boshghabyar.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.text.TextStyle

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = AppColors.Primary,
                    surface = AppColors.Surface,
                    background = AppColors.Background,
                    error = AppColors.Error,
                ),
                typography = Typography(
                    bodyLarge = TextStyle(fontFamily = VazirmatnFont)
                ),
            ) {
                BoshghabYarApp(ApiClient(), SessionStore(this))
            }
        }
    }
}
