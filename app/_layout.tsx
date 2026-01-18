import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useEffect } from 'react';
import { initDatabase } from '../services/Database';

export default function Layout() {
    useEffect(() => {
        initDatabase().catch(e => console.error(e));
    }, []);

    return (
        <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }} />
            <StatusBar style="auto" />
        </View>
    );
}
