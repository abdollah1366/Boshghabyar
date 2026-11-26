package ir.boshghabyar.app

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

val VazirmatnFont = androidx.compose.ui.text.font.FontFamily(
    androidx.compose.ui.text.font.Font(R.font.vazirmatn_regular, FontWeight.Normal),
    androidx.compose.ui.text.font.Font(R.font.vazirmatn_bold, FontWeight.Bold),
)

object AppColors {
    val Primary = Color(0xFF0E7490)
    val PrimaryLight = Color(0xFFE1F4FA)
    val Secondary = Color(0xFFB52B98)
    val Accent = Color(0xFFD1390F)
    val Background = Color(0xFFF7F8F8)
    val Surface = Color(0xFFFFFFFF)
    val Border = Color(0xFFD6DADC)
    val Text = Color(0xFF303536)
    val TextSecondary = Color(0xFF677579)
    val Error = Color(0xFFBF2222)
}

val BodyStyle = TextStyle(fontSize = 16.sp, color = AppColors.Text)
val SmallStyle = TextStyle(fontSize = 14.sp, color = AppColors.TextSecondary)
val TitleStyle = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.Bold, color = AppColors.Text)

@Composable
fun AppCard(content: @Composable () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 16.dp),
        shape = RoundedCornerShape(12.dp),
        color = AppColors.Surface,
        border = BorderStroke(1.dp, AppColors.Border),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            content()
        }
    }
}

@Composable
fun SectionTitle(text: String) {
    Text(text, style = TitleStyle, modifier = Modifier.padding(bottom = 8.dp))
}

@Composable
fun AppButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: ButtonVariant = ButtonVariant.Primary,
    enabled: Boolean = true,
    loading: Boolean = false,
) {
    val container = when (variant) {
        ButtonVariant.Primary -> AppColors.Primary
        ButtonVariant.Secondary -> AppColors.Surface
        ButtonVariant.Accent -> AppColors.Accent
    }
    val content = when (variant) {
        ButtonVariant.Secondary -> AppColors.Primary
        else -> Color.White
    }
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = modifier
            .fillMaxWidth()
            .height(48.dp),
        shape = RoundedCornerShape(8.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (enabled) container else AppColors.Border,
            contentColor = content,
        ),
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.height(20.dp).width(20.dp),
                color = content,
                strokeWidth = 2.dp,
            )
        } else {
            Text(text, style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold))
        }
    }
}

enum class ButtonVariant { Primary, Secondary, Accent }

@Composable
fun RowScope.Metric(label: String, value: String, hint: String? = null) {
    Column(modifier = Modifier.weight(1f)) {
        Text(label, style = TextStyle(fontSize = 12.sp, color = AppColors.TextSecondary))
        Text(
            value,
            style = TextStyle(
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = AppColors.Primary,
            ),
        )
        if (hint != null) {
            Text(hint, style = TextStyle(fontSize = 12.sp, color = AppColors.TextSecondary))
        }
    }
}

@Composable
fun ProgressRow(label: String, value: Number, target: Number) {
    val v = value.toDouble()
    val t = target.toDouble().coerceAtLeast(1.0)
    val ratio = (v / t).coerceIn(0.0, 1.0).toFloat()
    val over = v > t
    Text(
        "$label  ${Math.round(v)} / ${Math.round(t)}",
        style = TextStyle(fontSize = 14.sp, color = AppColors.Text),
    )
    LinearProgressIndicator(
        progress = { ratio },
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        color = if (over) AppColors.Error else AppColors.Primary,
        trackColor = AppColors.PrimaryLight,
    )
}

@Composable
fun PersianField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String? = null,
    secure: Boolean = false,
    numeric: Boolean = false,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        placeholder = placeholder?.let { { Text(it) } },
        singleLine = true,
        modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
        visualTransformation = if (secure) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
            keyboardType = if (numeric) KeyboardType.Number else if (label == "ایمیل") KeyboardType.Email else KeyboardType.Text,
        ),
    )
}

@Composable
fun ErrorText(text: String?) {
    if (!text.isNullOrBlank()) {
        Text(
            text,
            style = TextStyle(fontSize = 14.sp, color = AppColors.Error, textAlign = TextAlign.Start),
            modifier = Modifier.padding(bottom = 8.dp),
        )
    }
}

@Composable
fun LoadingText(text: String = "در حال بارگذاری…") {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(16.dp)) {
        CircularProgressIndicator(modifier = Modifier.height(20.dp).width(20.dp))
        Spacer(Modifier.width(8.dp))
        Text(text, style = SmallStyle)
    }
}

@Composable
fun EmptyText(text: String) {
    Text(text, style = SmallStyle, modifier = Modifier.padding(vertical = 8.dp))
}

@Composable
fun MetricRow(
    first: @Composable RowScope.() -> Unit,
    second: @Composable RowScope.() -> Unit,
) {
    Row(modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)) {
        first()
        Spacer(Modifier.width(16.dp))
        second()
    }
}

@Composable
fun BoxCenter(content: @Composable () -> Unit) {
    Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxWidth()) {
        content()
    }
}
