// What the phone says about heat and power, for lib/videoBudget: ProcessInfo.thermalState (nominal 0, fair 1, serious 2,
// critical 3; Apple asks apps to do less as it rises) and Low Power Mode (the person asking for less). JS reads them with
// current() and hears of a change through the "change" event.
import ExpoModulesCore

public class PowerStateModule: Module {
  private var observers: [NSObjectProtocol] = []

  public func definition() -> ModuleDefinition {
    Name("PowerState")

    Events("change")

    Function("current") { () -> [String: Any] in
      let (thermal, lowPower) = PowerStateModule.read()
      return ["thermal": thermal, "lowPower": lowPower]
    }

    OnStartObserving {
      let center = NotificationCenter.default
      let send: (Notification) -> Void = { [weak self] _ in
        let (thermal, lowPower) = PowerStateModule.read()
        self?.sendEvent("change", ["thermal": thermal, "lowPower": lowPower])
      }
      self.observers = [
        center.addObserver(forName: ProcessInfo.thermalStateDidChangeNotification, object: nil, queue: .main, using: send),
        center.addObserver(forName: Notification.Name.NSProcessInfoPowerStateDidChange, object: nil, queue: .main, using: send),
      ]
    }

    OnStopObserving {
      self.observers.forEach { NotificationCenter.default.removeObserver($0) }
      self.observers = []
    }
  }

  private static func read() -> (Int, Bool) {
    let info = ProcessInfo.processInfo
    return (info.thermalState.rawValue, info.isLowPowerModeEnabled)
  }
}
