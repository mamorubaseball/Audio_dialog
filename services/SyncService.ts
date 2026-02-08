import * as FileSystem from 'expo-file-system/legacy';
import { EntryService, Entry } from './EntryService';
import { GoogleDriveService } from './GoogleDriveService';

export const SyncService = {
    // Expose helpers for fine-grained control
    async getPendingEntries() {
        return await EntryService.getUnsyncedEntries();
    },

    async syncTextForPending(pendingEntries: Entry[]): Promise<{ success: boolean; errors: string[] }> {
        const errors: string[] = [];

        // Helper to get JST YYYY-MM-DD
        const getJSTDateStr = (isoString: string) => {
            const date = new Date(isoString);
            const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
            return jstDate.toISOString().split('T')[0];
        };

        // Group by Date (YYYY-MM-DD JST)
        const entriesByDate: { [date: string]: Entry[] } = {};
        for (const entry of pendingEntries) {
            const dateStr = getJSTDateStr(entry.date);
            if (!entriesByDate[dateStr]) entriesByDate[dateStr] = [];
            entriesByDate[dateStr].push(entry);
        }

        // Process each day for TEXT only
        for (const dateStr of Object.keys(entriesByDate)) {
            const dateObj = new Date(dateStr);
            console.log(`SyncService: Generating text for ${dateStr}`);

            try {
                const allEntriesForDay = await EntryService.getEntriesForJSTDate(dateStr);
                allEntriesForDay.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                const aggregatedText = allEntriesForDay
                    .map(e => {
                        const d = new Date(e.date);
                        const time = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
                        const text = e.text ? e.text.trim() : "(No Text)";
                        return `[${time}]\n${text}\n`;
                    })
                    .join('\n');

                if (aggregatedText.trim().length > 0) {
                    const summaryFileName = `${dateStr}-diary.txt`;
                    // Add slash if missing. documentDirectory is string | null
                    const docDir = FileSystem.documentDirectory?.endsWith('/') ? FileSystem.documentDirectory : `${FileSystem.documentDirectory}/`;

                    if (!docDir) {
                        errors.push(`Document directory is null`);
                        continue;
                    }

                    const txtPath = docDir + summaryFileName;
                    await FileSystem.writeAsStringAsync(txtPath, aggregatedText, { encoding: 'utf8' });

                    const textRes = await GoogleDriveService.uploadFile(txtPath, dateObj, summaryFileName);
                    await FileSystem.deleteAsync(txtPath, { idempotent: true });

                    if (!textRes.success) {
                        errors.push(`Failed to update diary text for ${dateStr}: ${textRes.error}`);
                    }
                }
            } catch (e: any) {
                errors.push(`Error generating/uploading text for ${dateStr}: ${e.message}`);
            }
        }

        return { success: errors.length === 0, errors };
    },

    async syncAudioForPending(pendingEntries: Entry[]): Promise<{ syncedCount: number; errors: string[] }> {
        let syncedCount = 0;
        const errors: string[] = [];

        // Helper to get JST YYYY-MM-DD (Same helper needed here)
        const getJSTDateStr = (isoString: string) => {
            const date = new Date(isoString);
            const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
            return jstDate.toISOString().split('T')[0];
        };

        for (const entry of pendingEntries) {
            try {
                const dateStr = getJSTDateStr(entry.date);
                const dateObj = new Date(dateStr);

                // Upload Audio
                const fileInfo = await FileSystem.getInfoAsync(entry.audio_path);
                if (fileInfo.exists) {
                    if (fileInfo.isDirectory) {
                        console.warn(`Skipping directory: ${entry.audio_path}`);
                        continue;
                    }

                    const audioRes = await GoogleDriveService.uploadFile(entry.audio_path, dateObj);
                    if (!audioRes.success) {
                        errors.push(`Audio upload failed for ${entry.id}: ${audioRes.error}`);
                        continue; // Don't mark as synced
                    }
                    // Delete local audio
                    await FileSystem.deleteAsync(entry.audio_path, { idempotent: true });
                } else {
                    console.warn(`Audio missing for ${entry.id}`);
                }

                // Mark synced
                await EntryService.markAsSynced(entry.id);
                syncedCount++;
            } catch (e: any) {
                errors.push(`Error syncing audio entry ${entry.id}: ${e.message}`);
            }
        }
        return { syncedCount, errors };
    },

    // Keep original for backward compatibility if needed, or update to use new methods
    async syncPendingEntries(): Promise<{ syncedCount: number; errors: string[] }> {
        console.log("SyncService: start");
        const pendingEntries = await EntryService.getUnsyncedEntries();
        console.log(`Found ${pendingEntries.length} pending entries to sync.`);

        // 1. Sync Text
        const textRes = await this.syncTextForPending(pendingEntries);

        // 2. Sync Audio
        const audioRes = await this.syncAudioForPending(pendingEntries);

        return {
            syncedCount: audioRes.syncedCount,
            errors: [...textRes.errors, ...audioRes.errors]
        };
    }
};
