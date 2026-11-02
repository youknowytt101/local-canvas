// iOS 18's zoom transition (UIViewController.preferredTransition = .zoom, as Photos and the App Store) for the element
// viewer, the person's choice (HANDOFF 6.173): the pushed screen grows out of the tile tapped and shrinks back into the
// tile of the element on screen, and can be dragged down to go back. react-native-screens hands a push with its default
// animation to UIKit (no animator of its own), and UIKit then uses the pushed controller's preferredTransition; this
// module sets it on the next push once JS has armed it (its views are found by testID, React Native's
// accessibilityIdentifier):
//   - arm(viewerId, sourceId, mediaId): the next push zooms from the view `sourceId`, lined up with `mediaId` in it
//   - setTarget(viewerId, sourceId, mediaId): what that viewer zooms back into once it is on another element (or null:
//     no tile on screen, UIKit's fallback)
//   - forget(viewerId): the viewer has gone
import ExpoModulesCore
import ObjectiveC
import UIKit

final class ZoomTarget {
  var sourceId: String?
  var mediaId: String?
  init(sourceId: String?, mediaId: String?) {
    self.sourceId = sourceId
    self.mediaId = mediaId
  }
}

enum ZoomTransitionState {
  private static let lock = NSLock()
  private static var targets: [String: ZoomTarget] = [:]
  private static var pending: (viewerId: String, at: Date)?
  private static var installed = false
  static let pendingLifetime: TimeInterval = 1.5 // an armed push that has not happened by then is not this one

  static func install() {
    lock.lock()
    defer { lock.unlock() }
    guard !installed else { return }
    installed = true
    let cls: AnyClass = UINavigationController.self
    guard
      let original = class_getInstanceMethod(cls, #selector(UINavigationController.pushViewController(_:animated:))),
      let replacement = class_getInstanceMethod(cls, #selector(UINavigationController.lc_zoomPushViewController(_:animated:)))
    else { return }
    method_exchangeImplementations(original, replacement)
  }

  static func arm(viewerId: String, sourceId: String, mediaId: String) {
    lock.lock()
    defer { lock.unlock() }
    targets[viewerId] = ZoomTarget(sourceId: sourceId, mediaId: mediaId)
    pending = (viewerId, Date())
  }

  static func setTarget(viewerId: String, sourceId: String?, mediaId: String?) {
    lock.lock()
    defer { lock.unlock() }
    guard let target = targets[viewerId] else { return }
    target.sourceId = sourceId
    target.mediaId = mediaId
  }

  static func forget(viewerId: String) {
    lock.lock()
    defer { lock.unlock() }
    targets.removeValue(forKey: viewerId)
  }

  // the armed push's target, once
  static func takePending() -> ZoomTarget? {
    lock.lock()
    defer { lock.unlock() }
    guard let p = pending else { return nil }
    pending = nil
    guard Date().timeIntervalSince(p.at) < pendingLifetime else { return nil }
    return targets[p.viewerId]
  }

  static func ids(_ target: ZoomTarget) -> (String?, String?) {
    lock.lock()
    defer { lock.unlock() }
    return (target.sourceId, target.mediaId)
  }
}

func findView(_ id: String, in root: UIView) -> UIView? {
  if root.accessibilityIdentifier == id { return root }
  for sub in root.subviews {
    if let found = findView(id, in: sub) { return found }
  }
  return nil
}

// the vertical scroll of a screen (the viewer's list), to let a drag down go back only from its top
func verticalScrollView(in root: UIView) -> UIScrollView? {
  if let scroll = root as? UIScrollView, scroll.contentSize.height > scroll.bounds.height + 1,
    scroll.contentSize.width <= scroll.bounds.width + 1 {
    return scroll
  }
  for sub in root.subviews {
    if let found = verticalScrollView(in: sub) { return found }
  }
  return nil
}

@available(iOS 18.0, *)
func zoomTransition(for target: ZoomTarget) -> UIViewController.Transition {
  let options = UIViewController.Transition.ZoomOptions()
  // the source lines up with the viewer's media, not the whole screen
  options.alignmentRectProvider = { context in
    let root = context.zoomedViewController.view!
    guard let id = ZoomTransitionState.ids(target).1, let media = findView(id, in: root) else { return nil }
    let rect = media.convert(media.bounds, to: root)
    return rect.width > 1 && rect.height > 1 ? rect : nil
  }
  options.interactiveDismissShouldBegin = { context in
    guard let scroll = verticalScrollView(in: context.zoomedViewController.view) else { return true }
    return scroll.contentOffset.y + scroll.adjustedContentInset.top <= 1
  }
  return .zoom(options: options) { context in
    guard let id = ZoomTransitionState.ids(target).0 else { return nil }
    let roots = [context.sourceViewController.view].compactMap { $0 }
      + UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap { $0.windows }
    for root in roots {
      guard let view = findView(id, in: root) else { continue }
      // only a tile that can be seen: one scrolled away or out of sight is no place to zoom back into
      let rect = view.convert(view.bounds, to: root)
      if view.isHidden || view.alpha < 0.01 || rect.width < 4 || rect.height < 4 || !rect.intersects(root.bounds) {
        return nil
      }
      return view
    }
    return nil
  }
}

extension UINavigationController {
  // exchanged with pushViewController(_:animated:) by ZoomTransitionState.install(): this calls the original
  @objc func lc_zoomPushViewController(_ viewController: UIViewController, animated: Bool) {
    if animated, #available(iOS 18.0, *), let target = ZoomTransitionState.takePending() {
      viewController.preferredTransition = zoomTransition(for: target)
    }
    lc_zoomPushViewController(viewController, animated: animated)
  }
}

public class ZoomTransitionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ZoomTransition")

    OnCreate {
      ZoomTransitionState.install()
    }

    Function("isAvailable") { () -> Bool in
      if #available(iOS 18.0, *) { return true }
      return false
    }

    Function("arm") { (viewerId: String, sourceId: String, mediaId: String) in
      ZoomTransitionState.arm(viewerId: viewerId, sourceId: sourceId, mediaId: mediaId)
    }

    Function("setTarget") { (viewerId: String, sourceId: String?, mediaId: String?) in
      ZoomTransitionState.setTarget(viewerId: viewerId, sourceId: sourceId, mediaId: mediaId)
    }

    Function("forget") { (viewerId: String) in
      ZoomTransitionState.forget(viewerId: viewerId)
    }
  }
}
