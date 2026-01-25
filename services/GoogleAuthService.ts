import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

const IosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
const STORAGE_KEY = 'google_auth_token';

export interface AuthToken {
    accessToken: string;
    refreshToken?: string;
    expiryDate?: number;
}

export const GoogleAuthService = {
    useGoogleAuth() {
        // Since we don't have an Android/Web ID yet, we'll just use iOS for now or leave others undefined
        const [request, response, promptAsync] = Google.useAuthRequest({
            iosClientId: IosClientId,
            // androidClientId: '...',
            scopes: ['https://www.googleapis.com/auth/drive.file'],
            redirectUri: makeRedirectUri({
                scheme: `com.googleusercontent.apps.${IosClientId.split('.apps.')[0]}`
            })
        });

        return { request, response, promptAsync };
    },

    async saveToken(token: AuthToken) {
        await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(token));
    },

    async getToken(): Promise<AuthToken | null> {
        const json = await SecureStore.getItemAsync(STORAGE_KEY);
        if (!json) return null;
        const token = JSON.parse(json);

        // Check if expired (with 60s buffer)
        // expiryDate is in seconds (from Google auth response), Date.now() is ms
        if (token.expiryDate && (Date.now() / 1000) > (token.expiryDate - 60)) {
            console.log("Token expired, removing...");
            await this.logout();
            return null;
        }
        return token;
    },

    async logout() {
        await SecureStore.deleteItemAsync(STORAGE_KEY);
    }
};
