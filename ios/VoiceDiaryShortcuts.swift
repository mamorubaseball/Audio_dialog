import AppIntents
import UIKit

// Define the "Start Recording" Intent
@available(iOS 16.0, *)
struct RecordVoiceDiaryIntent: AppIntent {
    static var title: LocalizedStringResource = "Start Recording"
    static var description = IntentDescription("Opens Voice Diary and starts recording immediately.")
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        // Deep link to the record action
        if let url = URL(string: "voicediary://?record=true") {
            await UIApplication.shared.open(url)
        }
        return .result()
    }
}

// Define the Shortcuts Provider (tells the system about the intent)
@available(iOS 16.0, *)
struct VoiceDiaryShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: RecordVoiceDiaryIntent(),
            phrases: [
                "Start recording in \(.applicationName)"
            ],
            shortTitle: "Start Recording",
            systemImageName: "mic.circle.fill"
        )
    }
}
