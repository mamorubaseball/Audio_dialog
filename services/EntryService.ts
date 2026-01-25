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
