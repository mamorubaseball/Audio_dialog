import * as FileSystem from 'expo-file-system/legacy';
import { EntryService, Entry } from './EntryService';
import { GoogleDriveService } from './GoogleDriveService';

export const SyncService = {
    async syncPendingEntries(): Promise<{ syncedCount: number; errors: string[] }> {
        const pendingEntries = await EntryService.getUnsyncedEntries();
        console.log(`Found ${pendingEntries.length} pending entries to sync.`);

        let syncedCount = 0;
        const errors: string[] = [];

        // Group by Date (YYYY-MM-DD)
        const entriesByDate: { [date: string]: Entry[] } = {};
        for (const entry of pendingEntries) {
            const dateStr = entry.date.split('T')[0];
            if (!entriesByDate[dateStr]) entriesByDate[dateStr] = [];
            entriesByDate[dateStr].push(entry);
        }

        // Process each day
        for (const dateStr of Object.keys(entriesByDate)) {
            const dailyEntries = entriesByDate[dateStr];
            const dateObj = new Date(dateStr); // Local time might be an issue if ISO is UTC. 
            // Assuming entry.date is ISO. 2026-01-25T...
            // dateStr 2026-01-25 is basically UTC date.
            // For now, let's treat it as the target folder name source.

            // 1. Prepare Aggregated Text
            // We need to fetch ALL entries for this day to rebuild the full diary?
            // "When uploading... combine into 1 file... store in 1 file"
            // If I only take pending items, and I overwrite the file, I lose previous items if they aren't in `dailyEntries`.
            // So I must fetch ALL entries for this date from DB.
            const allEntriesForDay = await EntryService.getEntriesByDate(dateStr);
            // Sort by created_at
            allEntriesForDay.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            const aggregatedText = allEntriesForDay
                .map(e => {
                    const time = new Date(e.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const text = e.text ? e.text.trim() : "(No Text)";
                    return `[${time}]\n${text}\n`;
                })
                .join('\n');

            // Upload Text Summary
            if (aggregatedText.trim().length > 0) {
                const summaryFileName = `${dateStr}-diary.txt`;
                const txtPath = `${FileSystem.documentDirectory}${summaryFileName}`;
                await FileSystem.writeAsStringAsync(txtPath, aggregatedText, { encoding: 'utf8' });

                const textRes = await GoogleDriveService.uploadFile(txtPath, dateObj, summaryFileName);
                await FileSystem.deleteAsync(txtPath, { idempotent: true });

                if (!textRes.success) {
                    errors.push(`Failed to update diary text for ${dateStr}: ${textRes.error}`);
                    // If text fails, should we stop audio sync? probably safe to continue audio.
                }
            }

            // 2. Upload Audio & Mark Synced
            for (const entry of dailyEntries) {
                try {
                    // Upload Audio
                    const fileInfo = await FileSystem.getInfoAsync(entry.audio_path);
                    if (fileInfo.exists) {
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
                    errors.push(`Error syncing entry ${entry.id}: ${e.message}`);
                }
            }
        }

        return { syncedCount, errors };
    }
};
