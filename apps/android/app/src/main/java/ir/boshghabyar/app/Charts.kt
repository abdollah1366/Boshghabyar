package ir.boshghabyar.app

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/** حلقهٔ پیشرفت (۰ تا fraction) با متن داخل */
@Composable
fun ProgressRing(
    fraction: Float,
    color: Color,
    size: Int = 132,
    stroke: Float = 12f,
    content: @Composable () -> Unit = {},
) {
    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(size.dp)) {
        val trackColor = MaterialTheme.colorScheme.surfaceVariant
        Canvas(modifier = Modifier.size(size.dp)) {
            val dim = size.dp.toPx()
            val st = stroke.dp.toPx()
            val inset = st / 2
            val arcSize = Size(dim - st, dim - st)
            withTransform({
                rotate(-90f)
            }) {
                drawArc(
                    color = trackColor,
                    startAngle = 0f,
                    sweepAngle = 360f,
                    useCenter = false,
                    topLeft = Offset(inset, inset),
                    size = arcSize,
                    style = Stroke(width = st, cap = StrokeCap.Round),
                )
                drawArc(
                    color = color,
                    startAngle = 0f,
                    sweepAngle = 360f * fraction.coerceIn(0f, 1f),
                    useCenter = false,
                    topLeft = Offset(inset, inset),
                    size = arcSize,
                    style = Stroke(width = st, cap = StrokeCap.Round),
                )
            }
        }
        content()
    }
}

/** نمودار میله‌ای ساده از نقاط کالری */
@Composable
fun BarChart(
    values: List<Int>,
    labels: List<String>,
    color: Color = MaterialTheme.colorScheme.primary,
    height: Int = 170,
) {
    val max = values.maxOrNull()?.coerceAtLeast(1) ?: 1
    Row(
        modifier = Modifier.fillMaxWidth().height(height.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.Bottom,
    ) {
        values.forEachIndexed { i, v ->
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(horizontal = 2.dp)) {
                val barHeight = (v.toFloat() / max * (height - 34).dp.value).coerceAtLeast(2f)
                Canvas(modifier = Modifier.width(18.dp).height(barHeight.dp)) {
                    drawRoundRect(
                        color = color,
                        size = Size(this.size.width, this.size.height),
                        cornerRadius = androidx.compose.ui.geometry.CornerRadius(5.dp.toPx(), 5.dp.toPx()),
                    )
                }
                Text(
                    labels.getOrElse(i) { "" },
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                )
            }
        }
    }
}
