import SwiftUI
import WidgetKit

// Real Quick widgets — self-contained (types duplicated from the app on
// purpose, BLUEPRINT §1). They read the snapshot the app writes to the App
// Group (src/widgets/snapshot.ts) and never touch the network.
//
//  • Snap (Lock Screen, circular): one tap opens the app straight into an
//    automatic photo — realquick://snap?from=widget.
//  • Today (Home small/medium + Lock Screen circular/rectangular/inline):
//    today's calories against the goal, with the same snap link.
//  • Snap control (iOS 18+): a Control Center / Lock Screen button that can
//    replace the flashlight or camera shortcut. Lives in SnapControl.swift.

let appGroup = "group.com.latovi.realquick.shared"
let snapshotKey = "realquick.widget"
let snapURL = URL(string: "realquick://snap?from=widget")!

struct SnapshotLabels: Codable {
    var of: String
    var left: String
    var snap: String
    var today: String
}

struct Snapshot: Codable {
    var day: String
    var weekday: Int
    var kcal: Int
    var goal: Int
    var unit: String
    var protein: Int
    var carbs: Int
    var fat: Int
    var pending: Int
    var label: SnapshotLabels

    static let placeholder = Snapshot(
        day: "", weekday: 0, kcal: 1110, goal: 2000, unit: "kcal", protein: 60, carbs: 128, fat: 36, pending: 0,
        label: SnapshotLabels(of: "of", left: "{n} left", snap: "Snap your food", today: "Today")
    )

    static func todayKey(_ date: Date = .now) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    static func load() -> Snapshot? {
        guard let raw = UserDefaults(suiteName: appGroup)?.string(forKey: snapshotKey),
              let data = raw.data(using: .utf8),
              var snap = try? JSONDecoder().decode(Snapshot.self, from: data)
        else { return nil }
        // Yesterday's numbers must never show as today's.
        if snap.day != todayKey() {
            snap.kcal = 0; snap.protein = 0; snap.carbs = 0; snap.fat = 0; snap.pending = 0
            snap.day = todayKey()
            snap.weekday = (Calendar(identifier: .gregorian).component(.weekday, from: .now) + 5) % 7
        }
        return snap
    }

    var progress: Double { goal > 0 ? min(1, Double(kcal) / Double(goal)) : 0 }
    var leftText: String {
        let diff = goal - kcal
        return diff >= 0 ? label.left.replacingOccurrences(of: "{n}", with: diff.formatted()) : "+\((-diff).formatted())"
    }
}

let ink = Color(red: 43 / 255, green: 35 / 255, blue: 80 / 255)
let blush = Color(red: 1, green: 158 / 255, blue: 181 / 255)
/// Monday-first pastel worlds, mirrored from src/theme.ts.
let dayBG: [Color] = [
    Color(red: 0xCF / 255, green: 0xF2 / 255, blue: 0xE2 / 255),
    Color(red: 0xFF / 255, green: 0xDC / 255, blue: 0xC9 / 255),
    Color(red: 0xE4 / 255, green: 0xDC / 255, blue: 0xFF / 255),
    Color(red: 0xFF / 255, green: 0xF1 / 255, blue: 0xB8 / 255),
    Color(red: 0xFF / 255, green: 0xD8 / 255, blue: 0xE6 / 255),
    Color(red: 0xD3 / 255, green: 0xEC / 255, blue: 0xFF / 255),
    Color(red: 0xE2 / 255, green: 0xF0 / 255, blue: 0xC6 / 255),
]
let dayRing: [Color] = [
    Color(red: 0x3F / 255, green: 0xAF / 255, blue: 0x82 / 255),
    Color(red: 0xF0 / 255, green: 0x7E / 255, blue: 0x45 / 255),
    Color(red: 0x7C / 255, green: 0x63 / 255, blue: 0xE0 / 255),
    Color(red: 0xE0 / 255, green: 0xA4 / 255, blue: 0x17 / 255),
    Color(red: 0xEC / 255, green: 0x5A / 255, blue: 0x8C / 255),
    Color(red: 0x3F / 255, green: 0x8E / 255, blue: 0xD6 / 255),
    Color(red: 0x6F / 255, green: 0xA2 / 255, blue: 0x2E / 255),
]

// MARK: - Timeline

struct Entry: TimelineEntry {
    let date: Date
    let snap: Snapshot
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: .now, snap: .placeholder) }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(Entry(date: .now, snap: Snapshot.load() ?? .placeholder))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let entry = Entry(date: .now, snap: Snapshot.load() ?? .placeholder)
        // The app reloads us on every change; also refresh just after midnight
        // so a new day starts at zero even if the app is never opened.
        let midnight = Calendar.current.startOfDay(for: .now.addingTimeInterval(86_400)).addingTimeInterval(60)
        completion(Timeline(entries: [entry], policy: .after(midnight)))
    }
}

// MARK: - Views

struct Ring: View {
    let progress: Double
    let color: Color
    var width: CGFloat = 8

    var body: some View {
        ZStack {
            Circle().stroke(color.opacity(0.22), lineWidth: width)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(color, style: StrokeStyle(lineWidth: width, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
    }
}

struct SnapButton: View {
    var size: CGFloat = 52

    var body: some View {
        Link(destination: snapURL) {
            ZStack {
                Circle().fill(blush)
                Circle().stroke(ink, lineWidth: 2.5)
                Image(systemName: "camera.fill")
                    .font(.system(size: size * 0.4, weight: .semibold))
                    .foregroundStyle(ink)
            }
            .frame(width: size, height: size)
        }
    }
}

struct TodayView: View {
    @Environment(\.widgetFamily) var family
    let snap: Snapshot

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                Gauge(value: snap.progress) {
                    Image(systemName: "fork.knife")
                } currentValueLabel: {
                    Text(snap.kcal.formatted()).font(.system(size: 12, weight: .bold, design: .rounded)).minimumScaleFactor(0.6)
                }
                .gaugeStyle(.accessoryCircular)
            }
            .widgetURL(snapURL)
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text("\(snap.kcal.formatted()) \(snap.unit)")
                    .font(.system(.headline, design: .rounded))
                    .widgetAccentable()
                Text("\(snap.label.of) \(snap.goal.formatted()) · \(snap.leftText)")
                    .font(.system(.caption, design: .rounded))
                ProgressView(value: snap.progress)
            }
            .widgetURL(snapURL)
        case .accessoryInline:
            Text("\(snap.kcal.formatted()) / \(snap.goal.formatted()) \(snap.unit)")
                .widgetURL(snapURL)
        case .systemMedium:
            HStack(spacing: 16) {
                ZStack {
                    Ring(progress: snap.progress, color: dayRing[snap.weekday % 7], width: 12)
                    VStack(spacing: 0) {
                        Text(snap.kcal.formatted())
                            .font(.system(size: 30, weight: .bold, design: .rounded))
                            .minimumScaleFactor(0.5)
                            .contentTransition(.numericText())
                        Text("\(snap.label.of) \(snap.goal.formatted())")
                            .font(.system(size: 11, weight: .semibold, design: .rounded))
                            .foregroundStyle(ink.opacity(0.6))
                    }
                    .padding(14)
                }
                .frame(width: 118, height: 118)
                VStack(alignment: .leading, spacing: 6) {
                    Text(snap.label.today).font(.system(.headline, design: .rounded))
                    macro("P", snap.protein, Color(red: 1, green: 0.5, blue: 0.44))
                    macro("C", snap.carbs, Color(red: 1, green: 0.73, blue: 0.22))
                    macro("F", snap.fat, Color(red: 0.27, green: 0.75, blue: 0.63))
                    Text(snap.leftText).font(.system(.caption, design: .rounded).weight(.bold)).foregroundStyle(ink.opacity(0.7))
                }
                Spacer(minLength: 0)
                SnapButton(size: 56)
            }
            .foregroundStyle(ink)
        default: // systemSmall
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(snap.label.today).font(.system(.subheadline, design: .rounded).weight(.bold))
                    Spacer()
                    SnapButton(size: 40)
                }
                Spacer(minLength: 0)
                Text(snap.kcal.formatted())
                    .font(.system(size: 38, weight: .bold, design: .rounded))
                    .minimumScaleFactor(0.5)
                    .contentTransition(.numericText())
                Text("\(snap.label.of) \(snap.goal.formatted()) \(snap.unit)")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(ink.opacity(0.6))
                ProgressView(value: snap.progress).tint(dayRing[snap.weekday % 7])
            }
            .foregroundStyle(ink)
        }
    }

    func macro(_ letter: String, _ grams: Int, _ color: Color) -> some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text("\(letter) \(grams)g").font(.system(.caption, design: .rounded).weight(.semibold))
        }
    }
}

struct TodayWidget: Widget {
    let kind = "RealQuickToday"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            TodayView(snap: entry.snap)
                .containerBackground(for: .widget) {
                    dayBG[entry.snap.weekday % 7]
                }
        }
        .configurationDisplayName("Today")
        .description("Today's calories, one tap from a snap.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

/// The single-purpose Lock Screen button: a camera in a circle.
struct SnapWidget: Widget {
    let kind = "RealQuickSnap"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { _ in
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "camera.fill").font(.system(size: 22, weight: .semibold))
            }
            .widgetURL(snapURL)
            .containerBackground(for: .widget) { Color.clear }
        }
        .configurationDisplayName("Snap")
        .description("One tap opens Real Quick and snaps your food.")
        .supportedFamilies([.accessoryCircular])
    }
}

@main
struct RealQuickWidgets: WidgetBundle {
    var body: some Widget {
        SnapWidget()
        TodayWidget()
        if #available(iOS 18.0, *) {
            SnapControl()
        }
    }
}
