import * as SQLite from 'expo-sqlite';

export const getDb = async () => {
    return await SQLite.openDatabaseAsync('voice_diary.db');
};

export const initDatabase = async () => {
    const db = await getDb();
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS entries (
            id TEXT PRIMARY KEY NOT NULL,
            date TEXT NOT NULL,
            duration INTEGER NOT NULL,
            audio_path TEXT NOT NULL,
            text TEXT,
            created_at TEXT NOT NULL
        );
    `);
};
