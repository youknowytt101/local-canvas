// What the phone says about heat and power, for lib/videoBudget, on the iOS scale: PowerManager's thermal status (API 29+;
// none 0, light 1, moderate 2, severe and over 3) and battery saver. JS reads them with current() and hears of a change
// through the "change" event.
package expo.modules.powerstate

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.PowerManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PowerStateModule : Module() {
  private val context: Context?
    get() = appContext.reactContext?.applicationContext
  private val power: PowerManager?
    get() = context?.getSystemService(Context.POWER_SERVICE) as? PowerManager

  private var thermalListener: PowerManager.OnThermalStatusChangedListener? = null
  private var saverReceiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("PowerState")

    Events("change")

    Function("current") { snapshot() }

    OnStartObserving {
      val pm = power ?: return@OnStartObserving
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val listener = PowerManager.OnThermalStatusChangedListener { sendEvent("change", snapshot()) }
        pm.addThermalStatusListener(context!!.mainExecutor, listener)
        thermalListener = listener
      }
      val receiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context?, intent: Intent?) {
          sendEvent("change", snapshot())
        }
      }
      val filter = IntentFilter(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        context?.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED) // a system broadcast still arrives
      } else {
        context?.registerReceiver(receiver, filter)
      }
      saverReceiver = receiver
    }

    OnStopObserving {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        thermalListener?.let { power?.removeThermalStatusListener(it) }
      }
      thermalListener = null
      saverReceiver?.let { runCatching { context?.unregisterReceiver(it) } }
      saverReceiver = null
    }
  }

  private fun snapshot(): Map<String, Any> {
    val pm = power
    val status = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && pm != null) pm.currentThermalStatus else 0
    val thermal = when {
      status >= PowerManager.THERMAL_STATUS_SEVERE -> 3
      status >= PowerManager.THERMAL_STATUS_MODERATE -> 2
      status >= PowerManager.THERMAL_STATUS_LIGHT -> 1
      else -> 0
    }
    return mapOf("thermal" to thermal, "lowPower" to (pm?.isPowerSaveMode ?: false))
  }
}
