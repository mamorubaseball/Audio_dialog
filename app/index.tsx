import { View, Text, TouchableOpacity, ScrollView, Alert, Dimensions, StyleSheet } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState, useEffect } from 'react';
import * as Linking from 'expo-linking';
import { AudioRecorderService } from '../services/AudioRecorderService';
import { EntryService, Entry } from '../services/EntryService';
import ContributionGraph from '../components/ContributionGraph';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import { GoogleAuthService, AuthToken } from '../services/GoogleAuthService';
import { GoogleDriveService } from '../services/GoogleDriveService';
import { SyncService } from '../services/SyncService';
import Voice from '@react-native-voice/voice';
import * as FileSystem from 'expo-file-system/legacy'; // Use legacy for writeAsStringAsync

export default function Home() {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [userToken, setUserToken] = useState<AuthToken | null>(null);
    const [syncing, setSyncing] = useState(false);

    // Transcription State
    const [transcribedText, setTranscribedText] = useState('');
    const [realtimeText, setRealtimeText] = useState('');

    const { request, response, promptAsync } = GoogleAuthService.useGoogleAuth();

    useEffect(() => {
        // Check local storage for token
        GoogleAuthService.getToken().then(setUserToken);
    }, []);

    useEffect(() => {
        if (response?.type === 'success') {
            const { authentication } = response;
            if (authentication) {
                const token: AuthToken = {
                    accessToken: authentication.accessToken,
                    refreshToken: authentication.refreshToken,
                    expiryDate: authentication.issuedAt + (authentication.expiresIn || 0)
                };
                GoogleAuthService.saveToken(token);
                setUserToken(token);
                Alert.alert("Connected", "Linked to Google Drive successfully!");
            }
        }
    }, [response]);

    useEffect(() => {
        return () => {
            if (sound) sound.unloadAsync();
        };
    }, [sound]);

    // Voice Recognition Setup
    useEffect(() => {
        Voice.onSpeechResults = (e: any) => {
            if (e.value && e.value.length > 0) {
                setRealtimeText(e.value[0]);
            }
        };
        Voice.onSpeechError = (e: any) => {
            console.error('Speech Error:', JSON.stringify(e, null, 2));
            if (e.error?.message) {
                // Common errors: "7/No match" (silence), "5/Client side error", "203/Retry"
                setRealtimeText(`Error: ${e.error.message}`);
            }
        };

        return () => {
            Voice.destroy().then(Voice.removeAllListeners);
        };
    }, []);

    const loadEntries = async () => {
        try {
            const data = await EntryService.getAllEntries();
            setEntries(data);
        } catch (e) {
            console.error(e);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadEntries();
        }, [])
    );

    // Deep Link Handling
    useEffect(() => {
        const handleDeepLink = async (event: { url: string }) => {
            if (event.url.includes("record")) {
                setTimeout(() => {
                    if (!isRecording) {
                        handleToggleRecording();
                    }
                }, 500);
            }
        };

        const subscription = Linking.addEventListener('url', handleDeepLink);
        Linking.getInitialURL().then((url) => {
            if (url) handleDeepLink({ url });
        });

        return () => subscription.remove();
    }, [isRecording]);

    const handleToggleRecording = async () => {
        if (isRecording && recording) {
            // Stop
            setIsRecording(false);
            try {
                await Voice.stop();
            } catch (e) {
                console.error("Voice stop error", e);
            }

            const result = await AudioRecorderService.stopRecording(recording);
            setRecording(null);

            // Finalize text
            const finalDocText = realtimeText || "";
            setTranscribedText(""); // Clear UI
            setRealtimeText("");

            if (result) {
                await EntryService.addEntry(result.durationMillis / 1000, result.uri, finalDocText);
                loadEntries();
                Alert.alert("Saved", "Voice diary saved successfully.");

                // Auto-Upload Removed - Batch Sync is now used
            }
        } else {
            // Start
            const hasPermission = await AudioRecorderService.requestPermissions();
            // Note: Voice permission is requested automatically on start() on iOS usually, or we can check
            if (!hasPermission) {
                Alert.alert("Permission Required", "Microphone access is needed.");
                return;
            }

            // Start Voice first or parallel
            try {
                setRealtimeText("");
                try {
                    await Voice.stop(); // Ensure clean state
                } catch (e) {
                    // Ignore stop error if not running
                }
                await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
                await Voice.start('ja-JP');
            } catch (e: any) {
                console.error("Voice start error", e);
                if (e.message && !e.message.includes('already started')) {
                    // Only alert if it's a real error, not just a state mismatch
                    // Alert.alert("Voice Error", "Could not start speech recognition.");
                }
            }

            const newRecording = await AudioRecorderService.startRecording();
            if (newRecording) {
                setRecording(newRecording);
                setIsRecording(true);
            }
        }
    };

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
            Alert.alert("Error", "Could not play audio file.");
        }
    };

    const handleSync = async () => {
        if (!userToken) {
            Alert.alert("Connect Drive", "Please connect to Google Drive first.");
            return;
        }

        setSyncing(true);
        try {
            const { syncedCount, errors } = await SyncService.syncPendingEntries();

            if (errors.length > 0) {
                Alert.alert("Sync Completed with Errors", `Synced: ${syncedCount}\nErrors:\n${errors.slice(0, 3).join('\n')}`);
            } else if (syncedCount > 0) {
                Alert.alert("Sync Complete", `Successfully uploaded ${syncedCount} entries.`);
            } else {
                Alert.alert("Up to Date", "No new entries to sync.");
            }
            loadEntries(); // Refresh list to show synced status (if we add icon later)
        } catch (e: any) {
            Alert.alert("Sync Failed", e.message);
        } finally {
            setSyncing(false);
        }
    };

    return (
        <View className="flex-1 bg-[#F5F5FA] pt-12">
            <View className="flex-row justify-between items-center px-6 mb-4">
                <Text className="text-2xl font-bold text-slate-800 tracking-wide">Voice Diary</Text>
                <View className="flex-row gap-2">
                    <TouchableOpacity
                        onPress={handleSync}
                        disabled={syncing}
                        className={`px-3 py-1.5 rounded-full ${syncing ? 'bg-blue-100' : 'bg-blue-500'}`}
                    >
                        <Text className={`text-xs font-semibold ${syncing ? 'text-blue-400' : 'text-white'}`}>
                            {syncing ? "Syncing..." : "Sync ☁️"}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => {
                            if (userToken) {
                                Alert.alert("Google Drive", "Status: Connected", [
                                    { text: "Cancel", style: "cancel" },
                                    {
                                        text: "Disconnect",
                                        style: "destructive",
                                        onPress: async () => {
                                            await GoogleAuthService.logout();
                                            setUserToken(null);
                                            Alert.alert("Disconnected", "Unlinked from Google Drive.");
                                        }
                                    }
                                ]);
                            } else {
                                promptAsync();
                            }
                        }}
                        className={`px-3 py-1.5 rounded-full ${userToken ? 'bg-green-100' : 'bg-slate-200'}`}
                    >
                        <Text className={`text-xs font-semibold ${userToken ? 'text-green-700' : 'text-slate-600'}`}>
                            {userToken ? "Drive On ✅" : "Connect Drive"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View className="h-40 mx-4 bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
                <ContributionGraph entries={entries} />
            </View>

            <View className="flex-1 items-center justify-center">
                <TouchableOpacity
                    onPress={handleToggleRecording}
                    activeOpacity={0.8}
                    className="items-center justify-center"
                    style={{
                        shadowColor: isRecording ? '#EF4444' : '#3B82F6',
                        shadowOffset: { width: 0, height: 10 },
                        shadowOpacity: 0.3,
                        shadowRadius: 20,
                        elevation: 10,
                    }}
                >
                    <LinearGradient
                        colors={isRecording ? ['#FF6B6B', '#EE5253'] : ['#4FACFE', '#00F2FE']}
                        className="w-28 h-28 rounded-full items-center justify-center border-4 border-white/30"
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <View className={`w-12 h-12 ${isRecording ? 'bg-white rounded-lg' : 'bg-white/20 rounded-full'}`} />
                    </LinearGradient>
                </TouchableOpacity>
                <Text className="mt-8 text-lg font-medium text-slate-500 tracking-wider">
                    {isRecording ? "Recording..." : "Tap to Record"}
                </Text>
                {isRecording && (
                    <Text className="mt-4 px-8 text-center text-slate-800 font-medium">
                        {realtimeText}
                    </Text>
                )}
            </View>

            <View className="flex-1 px-6 pb-8">
                <Text className="text-lg font-bold text-slate-700 mb-4">Recent Entries</Text>
                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    {entries.slice(0, 10).map(e => (
                        <View key={e.id} className="flex-row justify-between items-center p-4 mb-3 bg-white rounded-xl shadow-sm border border-slate-100">
                            <View className="flex-row items-center gap-3">
                                <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center">
                                    <Text className="text-blue-500 text-lg">🎙</Text>
                                </View>
                                <View>
                                    <Text className="text-slate-700 font-semibold text-base">
                                        {new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        <Text className="text-slate-400 font-normal ml-2 text-sm">
                                            {new Date(e.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    </Text>
                                    <Text className="font-mono text-xs text-slate-400 mt-1">{Math.round(e.duration)} seconds</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={() => playSound(e.audio_path, e.id)}
                                className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center"
                            >
                                <Text className="text-lg text-blue-600">
                                    {playingId === e.id ? "⏹" : "▶️"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                    {entries.length === 0 && (
                        <Text className="text-center text-slate-400 mt-10">No recordings yet.</Text>
                    )}
                </ScrollView>
            </View>
        </View>
    );
}
