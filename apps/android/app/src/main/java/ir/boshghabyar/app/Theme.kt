package ir.boshghabyar.app

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Icon
import androidx.compose.ui.graphics.vector.ImageVector

// ---------- فونت و رنگ ----------

val VazirmatnFont = FontFamily(
    Font(R.font.vazirmatn_regular, FontWeight.Normal),
    Font(R.font.vazirmatn_bold, FontWeight.Bold),
)

object AppColors {
    val Primary = Color(0xFF0E7490)
    val OnPrimary = Color(0xFFFFFFFF)
    val PrimaryContainer = Color(0xFFE1F4FA)
    val OnPrimaryContainer = Color(0xFF0B4D5E)
    val Secondary = Color(0xFFB52B98)
    val SecondaryContainer = Color(0xFFFBE4F5)
    val OnSecondaryContainer = Color(0xFF7A1B66)
    val Accent = Color(0xFFD1390F)
    val AccentContainer = Color(0xFFFCE8E0)
    val OnAccentContainer = Color(0xFF8F2708)
    val Background = Color(0xFFF7F8F8)
    val Surface = Color(0xFFFFFFFF)
    val SurfaceVariant = Color(0xFFEEF1F2)
    val Border = Color(0xFFD6DADC)
    val OnSurface = Color(0xFF303536)
    val OnSurfaceVariant = Color(0xFF677579)
    val Error = Color(0xFFBF2222)
    val ErrorContainer = Color(0xFFFBE4E4)
    val Success = Color(0xFF1E9E5A)
    val SuccessContainer = Color(0xFFE2F6EB)
    val Warning = Color(0xFFB7791F)
    val WarningContainer = Color(0xFFFDF1DF)
    val Gold = Color(0xFFC7890A)
    val GoldContainer = Color(0xFFFCF0D7)
}

val LightScheme = androidx.compose.material3.lightColorScheme(
    primary = AppColors.Primary,
    onPrimary = AppColors.OnPrimary,
    primaryContainer = AppColors.PrimaryContainer,
    onPrimaryContainer = AppColors.OnPrimaryContainer,
    secondary = AppColors.Secondary,
    onSecondary = Color.White,
    secondaryContainer = AppColors.SecondaryContainer,
    onSecondaryContainer = AppColors.OnSecondaryContainer,
    tertiary = AppColors.Accent,
    onTertiary = Color.White,
    tertiaryContainer = AppColors.AccentContainer,
    onTertiaryContainer = AppColors.OnAccentContainer,
    background = AppColors.Background,
    onBackground = AppColors.OnSurface,
    surface = AppColors.Surface,
    onSurface = AppColors.OnSurface,
    surfaceVariant = AppColors.SurfaceVariant,
    onSurfaceVariant = AppColors.OnSurfaceVariant,
    error = AppColors.Error,
    onError = Color.White,
    errorContainer = AppColors.ErrorContainer,
    onErrorContainer = Color(0xFF7A1515),
    outline = AppColors.Border,
    outlineVariant = AppColors.Border,
)

// ---------- کامپوننت‌های مشترک ----------

@Composable
fun AppCard(content: @Composable ColumnScope.() -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth().padding(bottom = 14.dp),
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, AppColors.Border.copy(alpha = 0.6f)),
        shadowElevation = 1.dp,
    ) {
        Column(modifier = Modifier.padding(16.dp), content = content)
    }
}

@Composable
fun SectionTitle(text: String, subtitle: String? = null) {
    Column(modifier = Modifier.padding(bottom = 10.dp)) {
        Text(text, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        if (subtitle != null) {
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun ScreenHeader(title: String, subtitle: String? = null) {
    Column(modifier = Modifier.padding(bottom = 16.dp)) {
        Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        if (subtitle != null) {
            Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

enum class ButtonVariant { Primary, Secondary, Accent, Outline }

@Composable
fun AppButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: ButtonVariant = ButtonVariant.Primary,
    enabled: Boolean = true,
    loading: Boolean = false,
) {
    if (variant == ButtonVariant.Outline) {
        OutlinedButton(
            onClick = onClick,
            enabled = enabled && !loading,
            modifier = modifier.fillMaxWidth().height(50.dp),
            shape = RoundedCornerShape(12.dp),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary),
        ) {
            ButtonContent(text, loading, MaterialTheme.colorScheme.primary)
        }
        return
    }
    val (container, content, disabled) = when (variant) {
        ButtonVariant.Primary -> Triple(AppColors.Primary, Color.White, AppColors.Border)
        ButtonVariant.Secondary -> Triple(AppColors.PrimaryContainer, AppColors.OnPrimaryContainer, AppColors.SurfaceVariant)
        ButtonVariant.Accent -> Triple(AppColors.Accent, Color.White, AppColors.Border)
        ButtonVariant.Outline -> Triple(Color.White, AppColors.Primary, Color.White)
    }
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = modifier.fillMaxWidth().height(50.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (enabled) container else disabled,
            contentColor = content,
            disabledContainerColor = disabled,
            disabledContentColor = AppColors.OnSurfaceVariant,
        ),
    ) {
        ButtonContent(text, loading, content)
    }
}

@Composable
private fun ButtonContent(text: String, loading: Boolean, content: Color) {
    if (loading) {
        CircularProgressIndicator(modifier = Modifier.size(20.dp), color = content, strokeWidth = 2.dp)
    } else {
        Text(text, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun Metric(label: String, value: String, hint: String? = null) {
    Column {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            value,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
        )
        if (hint != null) {
            Text(hint, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun ProgressRow(
    label: String,
    fraction: Float,
    valueText: String? = null,
    color: Color = MaterialTheme.colorScheme.primary,
) {
    Column(modifier = Modifier.padding(bottom = 10.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, style = MaterialTheme.typography.bodyMedium)
            if (valueText != null) {
                Text(valueText, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        LinearProgressIndicator(
            progress = { fraction.coerceIn(0f, 1f) },
            modifier = Modifier.fillMaxWidth().height(8.dp).padding(top = 2.dp),
            color = color,
            trackColor = MaterialTheme.colorScheme.surfaceVariant,
        )
    }
}

@Composable
fun PersianField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String? = null,
    secure: Boolean = false,
    numeric: Boolean = false,
    phone: Boolean = false,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        placeholder = placeholder?.let { { Text(it) } },
        singleLine = true,
        modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
        visualTransformation = if (secure) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(
            keyboardType = when {
                phone -> KeyboardType.Phone
                numeric -> KeyboardType.Number
                else -> KeyboardType.Text
            },
        ),
        shape = RoundedCornerShape(12.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            focusedContainerColor = MaterialTheme.colorScheme.surface,
        ),
    )
}

@Composable
fun ErrorText(text: String?) {
    if (!text.isNullOrBlank()) {
        Surface(
            color = MaterialTheme.colorScheme.errorContainer,
            shape = RoundedCornerShape(10.dp),
            modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp),
        ) {
            Row(
                modifier = Modifier.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(Icons.Filled.Info, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
                Text(text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onErrorContainer)
            }
        }
    }
}

@Composable
fun LoadingText(text: String = "در حال بارگذاری…") {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(16.dp)) {
        CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
        Spacer(Modifier.width(10.dp))
        Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun EmptyState(icon: ImageVector? = null, title: String, description: String? = null, action: @Composable () -> Unit = {}) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(44.dp))
        }
        Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
        if (description != null) {
            Text(
                description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
        action()
    }
}

@Composable
fun MetricRow(first: @Composable () -> Unit, second: @Composable () -> Unit) {
    Row(modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)) {
        Column(modifier = Modifier.weight(1f)) { first() }
        Spacer(Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) { second() }
    }
}

@Composable
fun Badge(text: String, container: Color, content: Color) {
    Surface(color = container, contentColor = content, shape = RoundedCornerShape(50)) {
        Text(
            text,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
fun PlanBadge(isPro: Boolean) {
    if (isPro) Badge("حرفه‌ای", AppColors.GoldContainer, AppColors.Gold)
    else Badge("رایگان", AppColors.SurfaceVariant, AppColors.OnSurfaceVariant)
}

@Composable
fun TokenChip(balance: Int, onClick: (() -> Unit)? = null) {
    val surface: @Composable () -> Unit = {
        Surface(color = AppColors.GoldContainer, shape = RoundedCornerShape(50), modifier = Modifier.padding(horizontal = 4.dp)) {
            Row(
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text("🪙", style = MaterialTheme.typography.labelLarge)
                Text(faNumber(balance), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = AppColors.Gold)
            }
        }
    }
    if (onClick != null) {
        Surface(onClick = onClick, color = Color.Transparent) { surface() }
    } else {
        surface()
    }
}
