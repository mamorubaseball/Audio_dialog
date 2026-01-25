import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface NeumorphicMicButtonProps {
    isRecording: boolean;
    onPress: () => void;
}

export default function NeumorphicMicButton({ isRecording, onPress }: NeumorphicMicButtonProps) {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const rippleAnim = useRef(new Animated.Value(0)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isRecording) {
            // Pulse animation
            Animated.loop(
                Animated.sequence([
                    Animated.timing(scaleAnim, {
                        toValue: 1.05,
                        duration: 1200,
                        useNativeDriver: true,
                        easing: Easing.inOut(Easing.ease),
                    }),
                    Animated.timing(scaleAnim, {
                        toValue: 1.0,
                        duration: 1200,
                        useNativeDriver: true,
                        easing: Easing.inOut(Easing.ease),
                    }),
                ])
            ).start();

            // Ripple animation
            Animated.loop(
                Animated.timing(rippleAnim, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.cubic),
                })
            ).start();

            // Slow rotation for the gradient border effect (if we added one)
            // For now, let's just keep the pulse elegant.
        } else {
            // Reset
            Animated.timing(scaleAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
            rippleAnim.setValue(0);
        }
    }, [isRecording]);

    return (
        <View style={styles.container}>
            {isRecording && (
                <Animated.View
                    style={[
                        styles.ripple,
                        {
                            transform: [{ scale: rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 2.8] }) }],
                            opacity: rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0] }),
                        },
                    ]}
                />
            )}

            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.9}
                style={styles.touchable}
            >
                <Animated.View style={[styles.buttonWrapper, { transform: [{ scale: scaleAnim }] }]}>
                    {/* Outer Neumorphic Shadows */}
                    <View style={styles.shadowLight}>
                        <View style={styles.shadowDark}>

                            {/* Main Button Body */}
                            <LinearGradient
                                // Recording: Dark Slate/Blue (Premium Tech feel) or Deep Red?
                                // User said "cheap" red. Let's try a very sleek dark mode look for recording or a high-end gradient.
                                // Let's go with a "Glassy" dark look for recording to contrast with the light theme.
                                colors={isRecording
                                    ? ['#334155', '#0f172a'] // Slate 700 -> Slate 900
                                    : ['#F8FAFC', '#E2E8F0']  // Light mode
                                }
                                style={styles.gradient}
                            >
                                {/* Inner Glow/Border for definition */}
                                <View style={[
                                    styles.innerFace,
                                    {
                                        borderColor: isRecording ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)',
                                        backgroundColor: isRecording ? 'transparent' : 'rgba(255,255,255,0.3)'
                                    }
                                ]}>
                                    <Ionicons
                                        name={isRecording ? "stop" : "mic"}
                                        size={30}
                                        // If recording (dark bg), use a Accent Color (Rose/Red) for the ICON, not the bg.
                                        color={isRecording ? "#F43F5E" : "#64748B"}
                                    />
                                </View>
                            </LinearGradient>
                        </View>
                    </View>
                </Animated.View>
            </TouchableOpacity>
        </View>
    );
}

const BUTTON_SIZE = 80;

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 140,
    },
    touchable: {
        zIndex: 10,
    },
    buttonWrapper: {
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        borderRadius: BUTTON_SIZE / 2,
    },
    shadowLight: {
        width: '100%',
        height: '100%',
        borderRadius: BUTTON_SIZE / 2,
        backgroundColor: 'transparent',
        shadowColor: '#FFFFFF',
        shadowOffset: { width: -6, height: -6 },
        shadowOpacity: 1,
        shadowRadius: 10,
    },
    shadowDark: {
        width: '100%',
        height: '100%',
        borderRadius: BUTTON_SIZE / 2,
        backgroundColor: 'transparent',
        shadowColor: '#94A3B8', // Common slate shadow
        shadowOffset: { width: 8, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 10,
    },
    gradient: {
        width: '100%',
        height: '100%',
        borderRadius: BUTTON_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    innerFace: {
        width: BUTTON_SIZE - 4, // Slight inner border look
        height: BUTTON_SIZE - 4,
        borderRadius: (BUTTON_SIZE - 4) / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    ripple: {
        position: 'absolute',
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        borderRadius: BUTTON_SIZE / 2,
        backgroundColor: 'rgba(148, 163, 184, 0.3)', // Slate ripple
        zIndex: 0,
    },
});
