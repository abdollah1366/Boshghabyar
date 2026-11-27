package ir.boshghabyar.app

import java.text.DecimalFormat
import java.util.Calendar
import java.util.Locale

fun faNumber(value: Number): String {
    val s = if (value is Double && value % 1.0 == 0.0) {
        value.toLong().toString()
    } else {
        value.toString()
    }
    return s.map { c ->
        if (c in '0'..'9') ('۰'.code + (c - '0')).toChar() else c
    }.joinToString("")
}

fun faNumber(value: Int): String = faNumber(value.toLong())

fun faMoney(value: Number): String {
    val formatter = DecimalFormat("#,##0")
    return faDigits(formatter.format(value.toLong()))
}

fun faDigits(input: String): String = input.map { c ->
    if (c in '0'..'9') ('۰'.code + (c - '0')).toChar() else c
}.joinToString("")

/** تاریخ جلالی از رشتهٔ YYYY-MM-DD؛ اگر ناموفق بود همان ورودی برمی‌گردد */
fun jalaliDate(iso: String, withYear: Boolean = true): String {
    return try {
        val parts = iso.split("-")
        val year = parts[0].toInt()
        val month = parts[1].toInt()
        val day = parts[2].toInt()
        val g = Calendar.getInstance()
        g.set(year, month - 1, day)
        val j = java.util.GregorianCalendar()
        j.time = g.time
        val fmt = if (withYear) "d MMMM yyyy" else "d MMM"
        val out = android.icu.text.SimpleDateFormat(fmt, android.icu.util.ULocale("fa_IR"))
        out.format(j.time)
    } catch (e: Exception) {
        iso
    }
}

/** تبدیل ارقام فارسی/عربی به لاتین برای فیلد شماره */
fun toLatin(input: String): String = input.map { c ->
    val code = c.code
    when {
        code in 0x06F0..0x06F9 -> (0x30 + (code - 0x06F0)).toChar()
        code in 0x0660..0x0669 -> (0x30 + (code - 0x0660)).toChar()
        else -> c
    }
}.joinToString("")

fun normalizePhone(input: String): String {
    var v = toLatin(input).filter { it.isDigit() }
    if (v.startsWith("98") && v.length == 12) v = "0" + v.substring(2)
    else if (v.length == 10 && v.startsWith("9")) v = "0" + v
    return v
}
