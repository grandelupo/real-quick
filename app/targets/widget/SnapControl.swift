import SwiftUI
import WidgetKit
import AppIntents

// iOS 18 control: shows up in Control Center, on the Lock Screen's bottom
// corners (in place of the flashlight / camera), and on the Action Button.
// One press opens Real Quick, which snaps immediately.

@available(iOS 18.0, *)
struct SnapControl: ControlWidget {
    static let kind = "com.latovi.realquick.snap"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: OpenSnapIntent()) {
                Label("Snap food", systemImage: "camera.fill")
            }
        }
        .displayName("Snap food")
        .description("Opens Real Quick and snaps your food.")
    }
}
