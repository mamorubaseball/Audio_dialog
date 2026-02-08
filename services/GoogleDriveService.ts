import { GoogleAuthService } from './GoogleAuthService';
import * as FileSystem from 'expo-file-system/legacy';
// import { EncodingType } from 'expo-file-system'; // Not available in recent versions directly or causing issues, using string 'base64' is safer

const BASE_URL = 'https://www.googleapis.com/drive/v3';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_NAME = '音声日記';

export const GoogleDriveService = {
    async getHeaders() {
        const token = await GoogleAuthService.getToken();
        if (!token?.accessToken) throw new Error("No access token");
        return {
            Authorization: `Bearer ${token.accessToken}`,
            'Content-Type': 'application/json',
        };
    },

    async findOrCreateFolder(name: string, parentId?: string): Promise<string | null> {
        try {
            const headers = await this.getHeaders();

            // 1. Search for folder
            let q = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
            if (parentId) {
                q += ` and '${parentId}' in parents`;
            }

            const searchRes = await fetch(`${BASE_URL}/files?q=${encodeURIComponent(q)}`, { headers });

            if (!searchRes.ok) {
                if (searchRes.status === 401) {
                    throw new Error("TokenExpired");
                }
                console.error(`Drive Search Error: ${searchRes.status}`, await searchRes.text());
                return null;
            }

            const searchData = await searchRes.json();

            if (searchData.files && searchData.files.length > 0) {
                return searchData.files[0].id;
            }

            // 2. Create if not exists
            const metadata: any = {
                name: name,
                mimeType: 'application/vnd.google-apps.folder'
            };
            if (parentId) {
                metadata.parents = [parentId];
            }

            const createRes = await fetch(`${BASE_URL}/files`, {
                method: 'POST',
                headers,
                body: JSON.stringify(metadata)
            });

            if (!createRes.ok) {
                console.error(`Drive Create Error: ${createRes.status}`, await createRes.text());
                return null;
            }

            const createData = await createRes.json();
            return createData.id;

        } catch (error) {
            console.error('Error finding/creating folder:', error);
            if ((error as any).message === 'TokenExpired') throw error;
            return null;
        }
    },

    async findOrCreateDailyFolder(date: Date): Promise<string | null> {
        const rootId = await this.findOrCreateFolder(FOLDER_NAME);
        if (!rootId) return null;

        // Convert key date to JST string YYYY-MM-DD
        // Note: 'date' argument here might already be 00:00:00 UTC if passed from SyncService
        // But if passed as `new Date()` (current time), we need to shift.
        // SyncService passes `new Date("2026-02-09")` -> 2026-02-09T00:00:00Z.
        // If we shift that by +9h, it becomes 2026-02-09T09:00:00Z -> split -> 2026-02-09. Correct.
        // If we pass `new Date()` (e.g. 2026-02-09 02:00 JST / 2026-02-08 17:00 UTC)
        // Shift +9h -> 2026-02-09 02:00. split -> 2026-02-09. Correct.

        const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
        const dateStr = jstDate.toISOString().split('T')[0]; // YYYY-MM-DD

        return await this.findOrCreateFolder(dateStr, rootId);
    },

    async findFile(name: string, parentId: string): Promise<string | null> {
        try {
            const headers = await this.getHeaders();
            let q = `name='${name}' and '${parentId}' in parents and trashed=false`;
            // Note: mimeType check if needed, but name should be unique enough for our usage
            const searchRes = await fetch(`${BASE_URL}/files?q=${encodeURIComponent(q)}`, { headers });

            if (!searchRes.ok) {
                if (searchRes.status === 401) throw new Error("TokenExpired");
                return null;
            }
            const data = await searchRes.json();
            if (data.files && data.files.length > 0) {
                return data.files[0].id;
            }
            return null;
        } catch (e: any) {
            if (e.message === 'TokenExpired') throw e;
            console.error('Find file error:', e);
            return null;
        }
    },

    async uploadFile(uri: string, date: Date = new Date(), forceFileName?: string): Promise<{ success: boolean; error?: string }> {
        try {
            const folderId = await this.findOrCreateDailyFolder(date);
            if (!folderId) return { success: false, error: "Failed to find or create folder." };

            const token = await GoogleAuthService.getToken();
            if (!token?.accessToken) return { success: false, error: "TokenExpired" };

            const originalName = uri.split('/').pop() || `recording-${Date.now()}.wav`;
            const fileName = forceFileName || originalName;
            const isText = fileName.endsWith('.txt');
            const mimeType = isText ? 'text/plain' : 'audio/wav';

            // Check if file exists to update it
            const existingFileId = await this.findFile(fileName, folderId);

            const fileContent = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

            if (existingFileId) {
                // Update
                const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`, {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${token.accessToken}`,
                        // Content-Type for PATCH with metadata+media is multipart/related
                        'Content-Type': `multipart/related; boundary=foo_bar_baz`,
                    },
                    body: `
--foo_bar_baz
Content-Type: application/json; charset=UTF-8

{}

--foo_bar_baz
Content-Type: ${mimeType}
Content-Transfer-Encoding: base64

${fileContent}

--foo_bar_baz--`
                });

                if (!res.ok) {
                    if (res.status === 401) return { success: false, error: "TokenExpired" };
                    const text = await res.text();
                    return { success: false, error: `Update API Error: ${res.status} ${text}` };
                }
                return { success: true };

            } else {
                // Create New
                const boundary = 'foo_bar_baz';
                const metadata = {
                    name: fileName,
                    parents: [folderId],
                    mimeType
                };

                const body = `
--${boundary}
Content-Type: application/json; charset=UTF-8

${JSON.stringify(metadata)}

--${boundary}
Content-Type: ${mimeType}
Content-Transfer-Encoding: base64

${fileContent}

--${boundary}--`;

                const res = await fetch(`${UPLOAD_URL}?uploadType=multipart`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token.accessToken}`,
                        'Content-Type': `multipart/related; boundary=${boundary}`,
                    },
                    body
                });

                if (!res.ok) {
                    if (res.status === 401) return { success: false, error: "TokenExpired" };
                    const text = await res.text();
                    console.error('Drive upload failed:', text);
                    return { success: false, error: `Upload API Error: ${res.status} ${text}` };
                }
                return { success: true };
            }
        } catch (error: any) {
            console.error('Error uploading file:', error);
            return { success: false, error: error.message || "Unknown upload error" };
        }
    }
};
