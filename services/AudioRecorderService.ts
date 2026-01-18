import { Audio } from 'expo-av';
import * as FileSystemMain from 'expo-file-system';
import { makeDirectoryAsync, moveAsync, documentDirectory } from 'expo-file-system/legacy';
import { Platform } from 'react-native';

// Debug logging to find the correct path property
console.log('FileSystemMain.Paths:', FileSystemMain.Paths);

export interface RecordingResult {
    uri: string;
    durationMillis: number;
}

export const AudioRecorderService = {
    async requestPermissions() {
        const response = await Audio.requestPermissionsAsync();
        return response.status === 'granted';
    },

    async startRecording() {
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            return recording;
        } catch (err) {
            console.error('Failed to start recording', err);
            return null;
        }
    },

    async stopRecording(recording: Audio.Recording): Promise<RecordingResult | null> {
        try {
            const status = await recording.getStatusAsync();
            const durationMillis = status.durationMillis;
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();

            if (!uri) return null;

            // Move file to permanent location: /Audio/yyyy/mm/dd/
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const fileName = `${now.toISOString().replace(/[:.]/g, '-')}.wav`; // simplified timestamp

            // Use legacy documentDirectory or fallback to Paths.document
            const docDir = documentDirectory || FileSystemMain.Paths?.document;

            console.log('Resolved docDir:', docDir);

            if (!docDir) {
                console.error('documentDirectory is null! Paths:', FileSystemMain.Paths);
                return null;
            }

            const directory = `${docDir}Audio/${year}/${month}/${day}/`;
            await makeDirectoryAsync(directory, { intermediates: true });

            const newUri = directory + fileName;
            await moveAsync({
                from: uri,
                to: newUri
            });

            return {
                uri: newUri,
                durationMillis: durationMillis
            };
        } catch (err) {
            console.error('Failed to stop recording', err);
            return null;
        }
    }
};
