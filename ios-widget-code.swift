//
//  VoiceDiaryWidget.swift
//  VoiceDiary
//
//  Created for Voice Diary App
//

import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let entry = SimpleEntry(date: Date())
        let timeline = Timeline(entries: [entry], policy: .never)
        completion(timeline)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
}

struct VoiceDiaryWidgetEntryView : View {
    var entry: Provider.Entry

    var body: some View {
        VStack {
            Image(systemName: "mic.circle.fill")
                .resizable()
                .frame(width: 40, height: 40)
                .foregroundColor(.red)
            Text("Record")
                .font(.caption)
                .bold()
        }
        .widgetURL(URL(string: "voicediary://record"))
        .containerBackground(for: .widget) {
            Color.white
        }
    }
}

struct VoiceDiaryWidget: Widget {
    let kind: String = "VoiceDiaryWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            VoiceDiaryWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Voice Recorder")
        .description("One tap to start recording.")
        .supportedFamilies([.systemSmall])
    }
}
