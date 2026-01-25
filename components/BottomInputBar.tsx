import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BottomInputBarProps {
    value?: string;
    onChangeText?: (text: string) => void;
    onSubmit?: () => void;
    isSubmitting?: boolean;
}

export default function BottomInputBar({ value, onChangeText, onSubmit, isSubmitting }: BottomInputBarProps) {
    return (
        <View style={styles.container}>
            <View style={styles.inputContainer}>
                <Ionicons name="text" size={20} color="#94A3B8" style={{ marginRight: 10 }} />
                <TextInput
                    style={styles.input}
                    placeholder="今の気持ちを入力..."
                    placeholderTextColor="#94A3B8"
                    value={value}
                    onChangeText={onChangeText}
                    onSubmitEditing={onSubmit}
                    returnKeyType="send"
                    editable={!isSubmitting}
                />
                {value ? (
                    <TouchableOpacity onPress={onSubmit} disabled={isSubmitting}>
                        <Ionicons name="send" size={20} color="#3B82F6" />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.spacer} />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 25,
        paddingVertical: 8,
        paddingHorizontal: 20,
        shadowColor: '#A3B1C6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    input: {
        flex: 1,
        color: '#1E293B',
        fontSize: 16,
        fontWeight: '500',
        paddingVertical: 4,
    },
    spacer: {
        width: 10,
    }
});
