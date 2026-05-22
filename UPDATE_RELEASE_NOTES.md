# Grav Hopper Update Notes

更新日: 2026-05-22

## Version

- iOS app version: 1.0.2
- iOS build number: 15
- EAS build page: https://expo.dev/accounts/ym3020/projects/gravity-dash/builds/7b738adc-929a-434c-8535-cc5f02027260
- EAS submission page: https://expo.dev/accounts/ym3020/projects/gravity-dash/submissions/d3967728-c860-4bc7-91f4-c5a297eff9b0
- App Store Connect build processing: https://appstoreconnect.apple.com/apps/6762042083/testflight/ios

## App Store Connect

### What's New in This Version

短め:

```text
・上下に動く床でジャンプが反応しにくい不具合を修正
・画面録画で効果音が録音されない不具合を修正
・HP表示と設定ボタンの位置を揃えてHUDを整理
```

おすすめ:

```text
プレイ感を改善するアップデートです。
・上下に動く床に乗っている時、ジャンプが反応しにくい不具合を修正しました。
・画面録画した時にゲームの効果音が録音されない不具合を修正しました。
・HPゲージと設定ボタンの高さを揃えて、上部HUDを見やすく整えました。
```

英語:

```text
Polish and stability update.
・Fixed missed jumps while standing on vertically moving platforms.
・Fixed game sound effects not being captured during iOS screen recording.
・Aligned the HP gauge with the settings button for a cleaner top HUD.
```

## Submit Flow

1. Build the new iOS version.
2. Submit the build to App Store Connect.
3. In App Store Connect, create version 1.0.2 if it is not already created.
4. Paste the release notes into "What's New in This Version".
5. Attach the uploaded build and submit for review.

## Commands

```bash
npx eas build --platform ios --profile production --auto-submit
```
