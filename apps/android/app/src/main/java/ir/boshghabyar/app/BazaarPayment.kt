package ir.boshghabyar.app

import android.content.Context
import androidx.activity.result.ActivityResultRegistry
import ir.cafebazaar.poolakey.Connection
import ir.cafebazaar.poolakey.ConnectionState
import ir.cafebazaar.poolakey.Payment
import ir.cafebazaar.poolakey.config.PaymentConfiguration
import ir.cafebazaar.poolakey.config.SecurityCheck
import ir.cafebazaar.poolakey.entity.PurchaseInfo
import ir.cafebazaar.poolakey.request.PurchaseRequest

/**
 * پرداخت درون‌برنامه‌ای کافه‌بازار با Poolakey.
 * مسیر: اتصال → خرید اشتراک → ارسال دادهٔ خرید به سرور برای تأیید و فعال‌سازی.
 */
class BazaarPayment(context: Context) {
    private val payment = Payment(
        context = context,
        config = PaymentConfiguration(localSecurityCheck = SecurityCheck.Disable),
    )
    private var connection: Connection? = null

    fun connect(onConnected: (Boolean) -> Unit) {
        connection = payment.connect {
            connectionSucceed { onConnected(true) }
            connectionFailed { onConnected(false) }
            disconnected { }
        }
    }

    fun isConnected(): Boolean = connection?.getState() == ConnectionState.Connected

    fun disconnect() {
        connection?.disconnect()
        connection = null
    }

    fun purchaseSubscription(
        registry: ActivityResultRegistry,
        productId: String,
        userId: String,
        onResult: (BazaarPurchaseResult) -> Unit,
    ) {
        val request = PurchaseRequest(productId = productId, payload = userId)
        payment.subscribeProduct(registry = registry, request = request) {
            purchaseFlowBegan { /* صفحهٔ پرداخت بازار باز شد */ }
            failedToBeginFlow { throwable ->
                onResult(BazaarPurchaseResult.Error(throwable.message ?: "باز شدن صفحهٔ پرداخت ناموفق بود"))
            }
            purchaseSucceed { info ->
                onResult(BazaarPurchaseResult.Success(info))
            }
            purchaseCanceled {
                onResult(BazaarPurchaseResult.Canceled)
            }
            purchaseFailed { throwable ->
                onResult(BazaarPurchaseResult.Error(throwable.message ?: "پرداخت ناموفق بود"))
            }
        }
    }
}

sealed class BazaarPurchaseResult {
    data class Success(val info: PurchaseInfo) : BazaarPurchaseResult()
    data object Canceled : BazaarPurchaseResult()
    data class Error(val message: String) : BazaarPurchaseResult()
}
