import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: "VoiceDiary",
    slug: "VoiceDiary",
    scheme: [
        "voicediary",
        `com.googleusercontent.apps.${process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.split('.apps.')[0]}`
    ],
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
        image: "./assets/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff"
    },
    ios: {
        supportsTablet: true,
        bundleIdentifier: "com.mamoru.voicediary",
        infoPlist: {
            NSSpeechRecognitionUsageDescription: "This app uses speech recognition to transcribe your voice diary entries into text.",
            NSMicrophoneUsageDescription: "This app needs access to your microphone to record your voice diary entries."
        }
    },
    plugins: [
        "expo-router",
        "expo-sqlite",
        "@react-native-voice/voice"
    ],
    android: {
        adaptiveIcon: {
            foregroundImage: "./assets/adaptive-icon.png",
            backgroundColor: "#ffffff"
        },
        edgeToEdgeEnabled: true,
        predictiveBackGestureEnabled: false
    },
    web: {
        favicon: "./assets/favicon.png"
    }
});
