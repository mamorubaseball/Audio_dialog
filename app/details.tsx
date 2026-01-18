import { View, Text, FlatList, TouchableOpacity } from 'react-native';
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
        <View className="flex-1 bg-white p-4">
            <Stack.Screen options={{ title: new Date(date!).toLocaleDateString() }} />

            <FlatList
                data={entries}
                keyExtractor={i => i.id}
                renderItem={({ item }) => (
                    <View className="flex-row items-center justify-between p-4 bg-gray-50 mb-2 rounded-lg">
                        <View>
                            <Text className="font-semibold text-gray-800">
                                {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            <Text className="text-gray-500 text-xs">{item.id.slice(0, 8)}</Text>
                        </View>

                        <View className="flex-row items-center gap-4">
                            <Text className="text-gray-600">{Math.round(item.duration)}s</Text>
                            <TouchableOpacity onPress={() => playSound(item.audio_path, item.id)}>
                                <Text className="text-2xl text-blue-500">
                                    {playingId === item.id ? "⏹" : "▶️"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                ListEmptyComponent={<Text className="text-center text-gray-500 mt-10">No recordings for this day.</Text>}
            />
        </View>
    );
}
