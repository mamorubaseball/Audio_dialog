# Voice Diary App

**コンセプト**: ウィジェット1タップで音声で感情を吐き出し、習慣化を可視化する日記アプリ。
**技術スタック**: React Native (Expo), TypeScript, NativeWind, SQLite, Expo AV.

## 機能一覧 (Phase 1 MVP)

*   **音声記録**: アプリ内またはディープリンク経由での録音。
*   **Contribution Graph**: GitHubのような草UIで録音習慣を可視化。
*   **詳細確認**: 日ごとの録音リストと再生機能。
*   **ローカル保存**: 音声データ(.wav)とメタデータ(SQLite)を端末内に保存。

## セットアップ & 実行方法

### 必須要件
*   Node.js
*   Mac (iOS Simulatorを使用する場合)
*   Xcode / iOS Simulator (または実機のExpo Goアプリ)

### インストール

```bash
cd VoiceDiary
npm install
```

### アプリの起動

```bash
npm start
```

1.  ターミナルにメニューが表示されます。
2.  **iOS Simulator**: `i` を押すとシミュレーターが起動・インストールされます。
3.  **実機**: App Storeから「Expo Go」をインストールし、カメラでQRコードをスキャンしてください。

## 動作確認 (Manual Verification)

### 1. 録音テスト
*   ホーム画面の青いマイクボタンをタップします。
*   マイクの許可を求められたら「許可」を選択してください。
*   数秒話した後、もう一度タップして停止します。
*   "Saved" アラートが表示され、Contribution Graphの色が変わり、Recentリストに追加されることを確認してください。

### 2. 再生テスト
*   Contribution Graphの色のついたマス、またはRecentリストをタップして詳細画面へ移動します。
*   再生ボタン (▶️) をタップして録音が再生されることを確認してください。

### 3. Widget (Deep Link) テスト
ウィジェット連携を模倣したテストです。

1.  iOS Simulatorでアプリをバックグラウンドにします（ホーム画面に戻る）。
2.  Simulatorの Safari を開きます。
3.  アドレスバーに `voicediary://record` と入力して開きます。
4.  アプリが自動的に開き、**約0.5秒後に録音が自動開始**されることを確認してください。

## プロジェクト構造

*   `app/`: 画面・ルーティング (Expo Router)
*   `services/`:
    *   `Database.ts`: SQLite初期化
    *   `EntryService.ts`: データ操作 (CRUD)
    *   `AudioRecorderService.ts`: 録音・ファイル管理利用
*   `components/`: UIコンポーネント (ContributionGraphなど)
*   `ios-widget-code.swift`: iOSネイティブWidget用の参考コード (Phase 2以降でNative Projectへ移行する際に使用)
