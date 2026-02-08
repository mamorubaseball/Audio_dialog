import { View, Text, TouchableOpacity, ScrollView, Alert, Dimensions, StyleSheet, KeyboardAvoidingView, Platform, Keyboard, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { AudioRecorderService } from '../services/AudioRecorderService';
import { EntryService, Entry } from '../services/EntryService';
import ContributionGraph from '../components/ContributionGraph';
import NeumorphicMicButton from '../components/NeumorphicMicButton';
import BottomInputBar from '../components/BottomInputBar';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

import { GoogleAuthService, AuthToken } from '../services/GoogleAuthService';
import { SyncService } from '../services/SyncService';
import Voice from '@react-native-voice/voice';

export default function Home() {
    const router = useRouter();
    const [entries, setEntries] = useState<Entry[]>([]);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [userToken, setUserToken] = useState<AuthToken | null>(null);
    const [syncing, setSyncing] = useState(false);

    // Transcription State
    const [realtimeText, setRealtimeText] = useState('');
    const scrollViewRef = useRef<ScrollView>(null);

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
                Alert.alert("接続完了", "Googleドライブと連携しました。");
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
                setRealtimeText(`エラー: ${e.error.message}`);
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
            setRealtimeText("");

            if (result) {
                await EntryService.addEntry(result.durationMillis / 1000, result.uri, finalDocText);
                loadEntries();
            }
        } else {
            // Start
            const hasPermission = await AudioRecorderService.requestPermissions();
            if (!hasPermission) {
                Alert.alert("マイクの許可", "録音にはマイクへのアクセスが必要です。");
                return;
            }

            // Start Voice first or parallel
            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: true,
                });

                setRealtimeText("");
                try {
                    await Voice.stop();
                } catch (e) { }
                await new Promise(resolve => setTimeout(resolve, 100));
                await Voice.start('ja-JP');
            } catch (e: any) {
                console.error("Voice start error", e);
            }

            const newRecording = await AudioRecorderService.startRecording();
            if (newRecording) {
                setRecording(newRecording);
                setIsRecording(true);
            }
        }
    };

    const [inputText, setInputText] = useState('');

    const handleTextSubmit = async () => {
        if (!inputText.trim()) return;

        const textToSave = inputText.trim();
        setInputText(''); // Clear immediately
        Keyboard.dismiss(); // Dismiss keyboard

        try {
            await EntryService.addEntry(0, "", textToSave);
            loadEntries();
        } catch (e) {
            console.error("Failed to save text entry", e);
            Alert.alert("エラー", "保存できませんでした。");
        }
    };

    const playSound = async (uri: string, id: string) => {
        if (!uri) return; // Handle text-only entries safely

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
            Alert.alert("エラー", "音声を再生できませんでした。");
        }
    };

    const handleSync = async () => {
        if (!userToken) {
            Alert.alert("Googleドライブ接続", "まずはGoogleドライブに接続してください。");
            return;
        }

        setSyncing(true);
        try {
            const { syncedCount, errors } = await SyncService.syncPendingEntries();

            if (errors.length > 0) {
                Alert.alert("同期エラー", `同期済み: ${syncedCount}件\nエラー:\n${errors.slice(0, 3).join('\n')}`);
            } else if (syncedCount > 0) {
                Alert.alert("同期完了", `${syncedCount}件の日記をドライブに保存しました。`);
            } else {
                Alert.alert("同期完了", "新しい日記はありません。");
            }
            loadEntries();
        } catch (e: any) {
            if (e.message && (e.message.includes('invalid') || e.message.includes('revoked') || e.message.includes('grant'))) {
                Alert.alert("セッション期限切れ", "Googleドライブに再接続してください。", [
                    { text: "OK", onPress: () => { GoogleAuthService.logout(); setUserToken(null); } }
                ]);
            } else {
                Alert.alert("同期失敗", e.message);
            }
        } finally {
            setSyncing(false);
        }
    };

    const [isKeyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => {
                setKeyboardVisible(true);
            }
        );
        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => {
                setKeyboardVisible(false);
            }
        );

        return () => {
            keyboardDidHideListener.remove();
            keyboardDidShowListener.remove();
        };
    }, []);

    return (
        <View className="flex-1 bg-[#F8FAFC]">
            {/* Premium Background Gradient */}
            <LinearGradient
                colors={['#F1F5F9', '#CBD5E1']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />
            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="flex-1">
                    {/* Header */}
                    <View className="px-6 py-4 flex-row justify-between items-center z-10">
                        <View>
                            <Text className="text-xs font-semibold text-slate-500 tracking-widest uppercase mb-1">Voice Diary</Text>
                            <Text className="text-3xl font-light text-slate-800 tracking-wide">日記</Text>
                        </View>

                        <View className="flex-row gap-4">
                            <TouchableOpacity
                                onPress={handleSync}
                                disabled={syncing}
                                className={`w-10 h-10 rounded-full items-center justify-center shadow-sm ${syncing ? 'bg-blue-100' : 'bg-white/90'}`}
                            >
                                <Ionicons name={syncing ? "cloud-upload" : "cloud-outline"} size={20} color={syncing ? "#3B82F6" : "#475569"} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => {
                                    if (userToken) {
                                        Alert.alert("Google Drive", "接続済み", [
                                            { text: "キャンセル", style: "cancel" },
                                            { text: "切断する", style: "destructive", onPress: async () => { await GoogleAuthService.logout(); setUserToken(null); } }
                                        ]);
                                    } else if (request) {
                                        promptAsync();
                                    }
                                }}
                                disabled={!userToken && !request}
                                className={`w-10 h-10 rounded-full items-center justify-center shadow-sm ${userToken ? 'bg-emerald-100' : (!request ? 'bg-slate-100' : 'bg-white/90')}`}
                            >
                                <Ionicons name="logo-google" size={18} color={userToken ? "#10B981" : "#475569"} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Top: Compact Stats */}
                    <View className="px-4 mt-2">
                        <ContributionGraph entries={entries} />
                    </View>

                    {/* Center: Transcription / Status Area */}
                    <View className="flex-1 justify-center px-6 pb-4">
                        {isRecording ? (
                            <View className="bg-white/40 rounded-3xl backdrop-blur-sm border border-white/20 overflow-hidden w-full flex-1 max-h-[70%] min-h-[300px]">
                                <ScrollView
                                    ref={scrollViewRef}
                                    contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}
                                    onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                                    showsVerticalScrollIndicator={false}
                                >
                                    <Text className="text-center text-slate-800 text-2xl font-light leading-relaxed tracking-wide">
                                        {realtimeText || "..."}
                                    </Text>
                                </ScrollView>
                            </View>
                        ) : (
                            realtimeText === "" && (
                                entries.length > 0 ? (
                                    <View className="items-center w-full">
                                        <Text className="text-slate-400 text-xs mb-4 font-medium tracking-widest uppercase opacity-80">最新のエントリー</Text>
                                        <TouchableOpacity
                                            onPress={() => router.push('/details')}
                                            className="w-full bg-white/60 p-6 rounded-3xl shadow-sm backdrop-blur-md border border-white/40"
                                            activeOpacity={0.7}
                                        >
                                            <View className="items-center justify-center">
                                                {entries[0].text ? (
                                                    <Text className="text-slate-700 text-lg font-medium text-center leading-relaxed">
                                                        {entries[0].text.length > 50 ? entries[0].text.substring(0, 50) + '...' : entries[0].text}
                                                    </Text>
                                                ) : (
                                                    <Ionicons name="mic-outline" size={32} color="#94A3B8" />
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View className="items-center opacity-60">
                                        <Ionicons name="mic-outline" size={48} color="#94A3B8" style={{ marginBottom: 10 }} />
                                        <Text className="text-slate-500 text-lg font-light tracking-widest">
                                            あなたの声を記録しましょう
                                        </Text>
                                    </View>
                                )
                            )
                        )}
                    </View>

                    {/* Bottom Center: Mic Button - Hidden when Keyboard is Visible */}
                    {!isKeyboardVisible && (
                        <View className="items-center justify-center pb-2">
                            <NeumorphicMicButton
                                isRecording={isRecording}
                                onPress={handleToggleRecording}
                            />
                            <Text className="mt-4 text-xs font-medium text-slate-400 tracking-widest opacity-80">
                                {isRecording ? "録音中" : "タップして録音"}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Bottom Controls */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    className="bg-transparent px-6 pb-6"
                >
                    <BottomInputBar
                        value={inputText}
                        onChangeText={setInputText}
                        onSubmit={handleTextSubmit}
                    />
                </KeyboardAvoidingView>
            </SafeAreaView>

            {/* Syncing Overlay */}
            <Modal
                transparent={true}
                visible={syncing}
                animationType="fade"
            >
                <View className="flex-1 justify-center items-center bg-black/30 backdrop-blur-sm">
                    <View className="bg-white p-6 rounded-2xl items-center shadow-lg w-48">
                        <ActivityIndicator size="large" color="#3B82F6" />
                        <Text className="mt-4 text-slate-600 font-medium">同期中...</Text>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    // Keep any specific styles if needed, but Tailwind is used mostly
});
