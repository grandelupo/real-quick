import AppIntents
import Foundation

// Shared with the main app target (the `_shared` folder is linked to both):
// an intent with openAppWhenRun must exist in the app too, or iOS will not
// launch it (https://developer.apple.com/forums/thread/763851).

@available(iOS 18.0, *)
struct OpenSnapIntent: AppIntent {
    static let title: LocalizedStringResource = "Snap food"
    static let description = IntentDescription("Opens Real Quick and snaps your food.")
    static let isDiscoverable = true
    static let openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(URL(string: "realquick://snap?from=widget")!))
    }
}
