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

    async findOrCreateFolder(): Promise<string | null> {
        try {
            const headers = await this.getHeaders();

            // 1. Search for folder
            const q = `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`;
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
            const createRes = await fetch(`${BASE_URL}/files`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    name: FOLDER_NAME,
                    mimeType: 'application/vnd.google-apps.folder'
                })
            });

            if (!createRes.ok) {
                console.error(`Drive Create Error: ${createRes.status}`, await createRes.text());
                return null;
            }

            const createData = await createRes.json();
            return createData.id;

        } catch (error) {
            console.error('Error finding/creating folder:', error);
            return null;
        }
    },

    async uploadFile(uri: string): Promise<{ success: boolean; error?: string }> {
        try {
            const folderId = await this.findOrCreateFolder();
            if (!folderId) return { success: false, error: "Failed to find or create folder." };

            const token = await GoogleAuthService.getToken();
            if (!token?.accessToken) return { success: false, error: "TokenExpired" };

            const fileName = uri.split('/').pop() || `recording-${Date.now()}.wav`;
            const isText = fileName.endsWith('.txt');
            const mimeType = isText ? 'text/plain' : 'audio/wav';
            // Always read as base64
            const fileContent = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

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
                if (res.status === 401) {
                    return { success: false, error: "TokenExpired" };
                }
                const text = await res.text();
                console.error('Drive upload failed:', text);
                return { success: false, error: `Upload API Error: ${res.status} ${text}` };
            }

            return { success: true };
        } catch (error: any) {
            console.error('Error uploading file:', error);
            return { success: false, error: error.message || "Unknown upload error" };
        }
    }
};
