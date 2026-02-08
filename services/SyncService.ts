import * as FileSystem from 'expo-file-system/legacy';
import { EntryService, Entry } from './EntryService';
import { GoogleDriveService } from './GoogleDriveService';

export const SyncService = {
    async syncPendingEntries(): Promise<{ syncedCount: number; errors: string[] }> {
        console.log("SyncService: start");
        const pendingEntries = await EntryService.getUnsyncedEntries();
        console.log(`Found ${pendingEntries.length} pending entries to sync.`);

        let syncedCount = 0;
        const errors: string[] = [];

        // Helper to get JST YYYY-MM-DD
        const getJSTDateStr = (isoString: string) => {
            const date = new Date(isoString);
            // Add 9 hours to get JST time in UTC representation
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

        // Process each day
        for (const dateStr of Object.keys(entriesByDate)) {
            console.log(`Processing date: ${dateStr}`);
            const dailyEntries = entriesByDate[dateStr];
            // dateStr is already "2026-02-09" (JST representation)
            // When we pass this to Date, we want it to stay as is for the folder name
            const dateObj = new Date(dateStr);

            // 1. Prepare Aggregated Text
            // We need to fetch ALL entries for this day to rebuild the full diary?
            // "When uploading... combine into 1 file... store in 1 file"
            // If I only take pending items, and I overwrite the file, I lose previous items if they aren't in `dailyEntries`.
            // So I must fetch ALL entries for this date from DB.
            const allEntriesForDay = await EntryService.getEntriesForJSTDate(dateStr);
            // Sort by created_at
            allEntriesForDay.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            const aggregatedText = allEntriesForDay
                .map(e => {
                    // Display time in JST
                    const d = new Date(e.date);
                    // Force JST display
                    const time = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
                    const text = e.text ? e.text.trim() : "(No Text)";
                    return `[${time}]\n${text}\n`;
                })
                .join('\n');

            // Upload Text Summary
            if (aggregatedText.trim().length > 0) {
                const summaryFileName = `${dateStr}-diary.txt`;
                // Add slash if missing. documentDirectory is string | null
                const docDir = FileSystem.documentDirectory?.endsWith('/') ? FileSystem.documentDirectory : `${FileSystem.documentDirectory}/`;

                if (!docDir) {
                    errors.push(`Document directory is null`);
                    continue;
                }

                const txtPath = docDir + summaryFileName;

                console.log(`Writing summary to: ${txtPath}`);
                await FileSystem.writeAsStringAsync(txtPath, aggregatedText, { encoding: 'utf8' });

                console.log(`Uploading summary: ${txtPath}`);
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
                    errors.push(`Error syncing entry ${entry.id}: ${e.message}`);
                }
            }
        }

        return { syncedCount, errors };
    }
};
