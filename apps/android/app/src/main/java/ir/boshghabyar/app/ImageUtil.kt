package ir.boshghabyar.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import java.io.ByteArrayOutputStream

object ImageUtil {
    private const val MAX_DIM = 1024

    fun compress(context: Context, uri: Uri): ByteArray {
        val input = context.contentResolver.openInputStream(uri) ?: throw IllegalStateException("تصویر خوانده نشد")
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeStream(input, null, bounds)
        input.close()

        val inSample = sampleSize(bounds.outWidth, bounds.outHeight)
        val input2 = context.contentResolver.openInputStream(uri)!!
        val options = BitmapFactory.Options().apply { inSampleSize = inSample }
        var bitmap = BitmapFactory.decodeStream(input2, null, options)
        input2.close()

        bitmap = bitmap ?: throw IllegalStateException("تصویر خوانده نشد")

        // چرخش EXIF
        val exif = context.contentResolver.openInputStream(uri)?.use { runCatching { ExifInterface(it) }.getOrNull() }
        val rotation = exif?.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) ?: ExifInterface.ORIENTATION_NORMAL
        val matrix = android.graphics.Matrix()
        when (rotation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
        }
        if (!matrix.isIdentity) {
            val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
            if (rotated !== bitmap) bitmap.recycle()
            bitmap = rotated
        }

        val scaled = scaleToMax(bitmap)
        if (scaled !== bitmap) bitmap.recycle()

        val out = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, 82, out)
        scaled.recycle()
        return out.toByteArray()
    }

    private fun sampleSize(w: Int, h: Int): Int {
        var sample = 1
        while (w / sample > MAX_DIM * 2 || h / sample > MAX_DIM * 2) sample *= 2
        return sample
    }

    private fun scaleToMax(bitmap: Bitmap): Bitmap {
        val max = maxOf(bitmap.width, bitmap.height)
        if (max <= MAX_DIM) return bitmap
        val scale = MAX_DIM.toFloat() / max
        return Bitmap.createScaledBitmap(
            bitmap,
            (bitmap.width * scale).toInt().coerceAtLeast(1),
            (bitmap.height * scale).toInt().coerceAtLeast(1),
            true,
        )
    }
}
