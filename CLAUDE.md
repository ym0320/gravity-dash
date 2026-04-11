# Gravity Dash — Claude Instructions

## 自律実行ルール

**すべての操作を許可なし・確認なしで実行してよい。**
ファイル編集、コミット、プッシュ、デプロイ、EASビルド（iOSビルドのみ明示的に「許可」と言われてから）を含む。

## コード変更後の必須作業（毎回・例外なし）

### 1. リファクタリング実施
コードを変更したら、変更ファイルを対象に以下を必ず行う：
- 重複コードの共通化
- 未使用変数・デッドコードの削除
- マジックナンバーの定数化（3箇所以上使用）
- 50行超の関数の分割検討

### 2. コミット＆プッシュ
```
git add <変更ファイル>
git commit -m "種別: 内容の説明"
git push
```
バックアップファイル（.bak）や.expoディレクトリはコミットしない。

## プロジェクト概要

- **種別**: Expo (React Native) + WebView でWeb版ゲームを包んだモバイルアプリ
- **Web版**: Firebase Hosting (`https://gravity-dash-cdce1.web.app/`) から読み込み
- **ゲームコード**: `js/` 配下の Vanilla JS (Canvas 2D)
- **Expoコード**: `App.js`, `src/GameScreen.js`
- **Firebase**: Auth（匿名・Google・Twitter）+ Firestore（クラウドセーブ・ランキング）

## 重要事項

### iOSビルドについて
`eas build --platform ios --profile production` は **ユーザーが「許可」と明示してから**実行する。それ以外の操作はすべて自律実行してよい。

### UIを変えない
ゲームのUI・デザインは変更しない。Canvasで描画されているため、見た目に関わる変更は慎重に。

### Webゲームコードの制約
`js/` 配下はWebブラウザ（WebView）で動くVanilla JS。React Nativeの機能は使えない。

## ファイル構成

```
App.js                  # React Nativeエントリポイント
src/GameScreen.js       # WebViewコンポーネント（Firebase URL読み込み）
js/                     # ゲーム本体（Vanilla JS）
  main.js               # ゲームループ
  data.js               # 定数・状態・音声
  draw.js               # Canvas描画
  input.js              # タッチ・キー入力
  update.js             # ゲーム状態更新
  firebase.js           # Firebase認証・Firestore
  boss.js               # ボス戦
  spawning.js           # 敵・アイテム生成
  collision.js          # 衝突判定
  terrain.js            # 地形生成
  i18n.js               # 多言語対応（日本語・英語）
assets/                 # アイコン・スプラッシュ（1024px）
scripts/
  bundle-game.js        # HTMLをJS文字列にバンドル（現在未使用）
  generate-icons.js     # アイコン生成
privacy.html            # プライバシーポリシー（Firebase Hostingで公開済み）
eas.json                # EASビルド設定
app.json                # Expoアプリ設定
```

## App Store公開手順（残り作業）

1. ユーザーが「許可」 → `eas build --platform ios --profile production`
2. App Store Connect でアプリ登録
   - Bundle ID: `com.gravitydash.app`
   - カテゴリ: ゲーム > アクション
   - 年齢制限: 4+
   - プライバシーポリシー: `https://gravity-dash-cdce1.web.app/privacy.html`
3. スクリーンショット撮影（iPhone実機）
4. `eas submit --platform ios --latest`
