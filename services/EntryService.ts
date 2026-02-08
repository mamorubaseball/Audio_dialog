import { getDb } from './Database';
import * as Crypto from 'expo-crypto';

export interface Entry {
    id: string;
    date: string; // ISO 8601
    duration: number; // Seconds
    audio_path: string;
    text?: string;
    created_at: string;
    is_synced: number; // 0 = false, 1 = true
}

export const EntryService = {
    async addEntry(duration: number, audioPath: string, text?: string) {
        const db = await getDb();
        const id = Crypto.randomUUID();
        const now = new Date().toISOString();

        await db.runAsync(
            `INSERT INTO entries (id, date, duration, audio_path, text, created_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [id, now, duration, audioPath, text ?? null, now]
        );
        return id;
    },

    async getAllEntries() {
        const db = await getDb();
        return await db.getAllAsync<Entry>(`SELECT * FROM entries ORDER BY date DESC`);
    },

    async getEntriesByDate(dateStr: string) {
        // Simple string matching for yyyy-mm-dd if needed, need to be careful with ISO strings
        // Ideally we store date as YYYY-MM-DD for grouping or query ranges
        // safely: date is ISO like 2026-01-15T10:32:00.000Z
        const db = await getDb();
        return await db.getAllAsync<Entry>(
            `SELECT * FROM entries WHERE date LIKE ? ORDER BY date DESC`,
            [`${dateStr}%`]
        );
    },

    async getEntriesForJSTDate(dateStr: string) {
        // dateStr is YYYY-MM-DD in JST
        // We need to find entries where the ISO date (UTC) falls within this JST day.
        // JST is UTC+9.
        // Start of Day JST: YYYY-MM-DD 00:00:00 JST -> YYYY-MM-DD 15:00:00 UTC (Previous Day)
        // End of Day JST:   YYYY-MM-DD 23:59:59.999 JST -> YYYY-MM-DD 14:59:59.999 UTC (Current Day)

        // Correction:
        // 00:00 JST = Previous Day 15:00 UTC.
        // Example: 2026-02-09 00:00 JST = 2026-02-08 15:00 UTC.
        //          2026-02-10 00:00 JST = 2026-02-09 15:00 UTC.

        const jstDate = new Date(dateStr); // Local time might interfere if running on device, but dateStr "YYYY-MM-DD" usually parses as UTC 00:00 if no time.
        // Safest is to construct explicitly.
        // dateStr "2026-02-09"

        const [y, m, d] = dateStr.split('-').map(Number);

        // Start: Y, M, D, 00, 00, 00 JST -> -9h for UTC
        const startJST = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
        const startUTC = new Date(startJST.getTime() - 9 * 60 * 60 * 1000);

        // End: Y, M, D+1, 00, 00, 00 JST (exclusive) -> -9h for UTC
        const endJST = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));
        const endUTC = new Date(endJST.getTime() - 9 * 60 * 60 * 1000);

        const startISO = startUTC.toISOString();
        const endISO = endUTC.toISOString();

        const db = await getDb();
        return await db.getAllAsync<Entry>(
            `SELECT * FROM entries WHERE date >= ? AND date < ? ORDER BY date DESC`,
            [startISO, endISO]
        );
    },

    async deleteEntry(id: string) {
        const db = await getDb();
        await db.runAsync(`DELETE FROM entries WHERE id = ?`, [id]);
    },

    async getUnsyncedEntries() {
        const db = await getDb();
        return await db.getAllAsync<Entry>(`SELECT * FROM entries WHERE is_synced = 0`);
    },

    async markAsSynced(id: string) {
        const db = await getDb();
        await db.runAsync(`UPDATE entries SET is_synced = 1 WHERE id = ?`, [id]);
    }
};
