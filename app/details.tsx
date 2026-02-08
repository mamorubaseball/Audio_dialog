import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { EntryService, Entry } from '../services/EntryService';
import { Audio } from 'expo-av';

export default function Details() {
    const { date } = useLocalSearchParams<{ date: string }>();
    const [entries, setEntries] = useState<Entry[]>([]);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [playingId, setPlayingId] = useState<string | null>(null);

    useEffect(() => {
        if (date) {
            // Parse ISO string to YYYY-MM-DD
            const dateObj = new Date(date);
            const dateStr = dateObj.toISOString().split('T')[0];
            EntryService.getEntriesByDate(dateStr).then(setEntries);
        }

        return () => {
            if (sound) sound.unloadAsync();
        };
    }, [date]);

    const playSound = async (uri: string, id: string) => {
        if (sound) {
            await sound.unloadAsync();
            setSound(null);
            setPlayingId(null);
            if (playingId === id) return; // Toggle off
        }

        try {
            const { sound: newSound } = await Audio.Sound.createAsync({ uri });
            setSound(newSound);
            setPlayingId(id);
            await newSound.playAsync();
            newSound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    setPlayingId(null);
                }
            });
        } catch (e) {
            console.error("Playback failed", e);
        }
    };

    return (
        <View className="flex-1 bg-[#F8FAFC]">
            {/* Header / Title */}
            <Stack.Screen
                options={{
                    title: date ? new Date(date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', year: 'numeric' }) : '日記詳細',
                    headerStyle: { backgroundColor: '#F8FAFC' },
                    headerShadowVisible: false,
                    headerTintColor: '#334155',
                }}
            />

            <ScrollView className="flex-1 px-4 py-2">
                <View className="bg-white rounded-2xl shadow-sm p-6 mb-8 min-h-[500px]">
                    <Text className="text-slate-400 text-xs font-bold tracking-widest uppercase mb-6 text-center">
                        Daily Record
                    </Text>

                    {entries.length === 0 ? (
                        <View className="items-center justify-center py-20">
                            <Text className="text-slate-400">この日の記録はありません</Text>
                        </View>
                    ) : (
                        entries.map((item, index) => (
                            <View key={item.id} className="mb-6 border-b border-slate-100 last:border-0 pb-4 last:pb-0">
                                <View className="flex-row items-center mb-2 justify-between">
                                    <View className="flex-row items-center">
                                        <View className="w-2 h-2 rounded-full bg-blue-400 mr-2" />
                                        <Text className="text-slate-400 text-xs font-medium">
                                            {new Date(item.date).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })}
                                        </Text>
                                    </View>

                                    <TouchableOpacity
                                        onPress={() => playSound(item.audio_path, item.id)}
                                        className={`w-8 h-8 rounded-full items-center justify-center ${playingId === item.id ? 'bg-red-50' : 'bg-slate-50'}`}
                                    >
                                        <Text className="text-sm">
                                            {playingId === item.id ? "⏹" : "▶️"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <Text className="text-slate-700 text-base leading-relaxed tracking-wide font-normal">
                                    {item.text || "(音声のみ)"}
                                </Text>
                            </View>
                        ))
                    )}
                </View>

                {/* Bottom Spacer */}
                <View className="h-10" />
            </ScrollView>
        </View>
    );
}
