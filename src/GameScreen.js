import React, { useRef, useEffect, useCallback } from 'react';
import { BackHandler, Platform, AppState, Vibration } from 'react-native';
import Constants from 'expo-constants';
import { WebView } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

WebBrowser.maybeCompleteAuthSession();

// ★ Firebase Console → Authentication → Sign-in method → Google →
//   「ウェブクライアントID」をここに貼り付けてください
const GOOGLE_WEB_CLIENT_ID = '4638520393-1bt3sfjolepmga5ema4o3g9nh8lbp54d.apps.googleusercontent.com';

// iOS OAuth クライアントID
// Expo Go (host.exp.Exponent) と本番ビルド (com.ym0320.gGravHopper) で別クライアントを使い分ける
const GOOGLE_IOS_CLIENT_ID_EXPO = '4638520393-hb9mhusilflfq031ee3f3prfhgo7ak21.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID_PROD = '4638520393-45de0k2fq3r90aj3l9mjdoab03iratmb.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = Constants.appOwnership === 'expo'
  ? GOOGLE_IOS_CLIENT_ID_EXPO
  : GOOGLE_IOS_CLIENT_ID_PROD;

const GAME_URL = 'https://gravity-dash-cdce1.web.app/';

const BRIDGE_JS = `
(function() {
  // バイブレーションをネイティブに橋渡し
  navigator.vibrate = function(pattern) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'vibrate',
        pattern: Array.isArray(pattern) ? pattern : [pattern]
      }));
    }
  };

  // React Native → WebView メッセージ受信
  window.addEventListener('message', function(e) {
    try {
      if (e.origin && e.origin !== 'https://gravity-dash-cdce1.web.app' && e.origin !== 'null') return;
      var msg = JSON.parse(e.data);
      if (msg.type === 'appState') {
        Object.defineProperty(document, 'hidden', {
          value: msg.hidden, configurable: true, writable: true
        });
        Object.defineProperty(document, 'visibilityState', {
          value: msg.hidden ? 'hidden' : 'visible', configurable: true, writable: true
        });
        document.dispatchEvent(new Event('visibilitychange'));
      }
      if (msg.type === 'backButton') {
        document.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape', code: 'Escape', keyCode: 27
        }));
      }
      // Google / Apple 認証結果をゲームに転送
      if (msg.type === 'googleCredential' || msg.type === 'appleCredential' ||
          msg.type === 'googleSignInError' || msg.type === 'appleSignInError') {
        window.dispatchEvent(new CustomEvent('nativeAuthResult', { detail: msg }));
      }
    } catch(err) {}
  });
  true;
})();
`;

export default function GameScreen({ onReady }) {
  const webViewRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const readyFired = useRef(false);
  const hapticGateRef = useRef({ style: '', at: 0 });
  const hapticNativeRef = useRef(0); // global native gate: limits actual Taptic Engine calls

  // Google OAuth (expo-auth-session)
  // iOS は iosClientId が必須。未設定時は webClientId をフォールバックに使い、
  // クラッシュを防ぐ（実際の認証はエラーになり googleSignInError として処理される）
  const [, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID,
  });

  // Google認証結果をWebViewに送る
  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === 'success') {
      const idToken = googleResponse.params?.id_token;
      if (idToken) {
        webViewRef.current?.postMessage(JSON.stringify({ type: 'googleCredential', idToken }));
      } else {
        webViewRef.current?.postMessage(JSON.stringify({ type: 'googleSignInError' }));
      }
    } else if (googleResponse.type === 'error') {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'googleSignInError' }));
    }
    // dismiss はユーザーキャンセルなので何もしない
  }, [googleResponse]);

  const fireReady = useCallback(() => {
    if (!readyFired.current) {
      readyFired.current = true;
      onReady && onReady();
    }
  }, [onReady]);

  // Androidの戻るボタン → ゲーム内ポーズ
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const handler = () => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'backButton' }));
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, []);

  // アプリのバックグラウンド/フォアグラウンド切替をWebViewに伝える
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const wasActive = appStateRef.current === 'active';
      const isActive = nextState === 'active';
      if (wasActive !== isActive) {
        webViewRef.current?.postMessage(JSON.stringify({
          type: 'appState',
          hidden: !isActive,
        }));
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  // WebViewにイベントを直接発火するヘルパー（postMessageより確実）
  const dispatchToWebView = useCallback((msg) => {
    const json = JSON.stringify(msg).replace(/\\/g, '\\\\').replace(/`/g, '\\`');
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new CustomEvent('nativeAuthResult',{detail:${json}}));true;`
    );
  }, []);

  // Apple Sign-In (iOS native) — nonce でリプレイ攻撃を防止
  const handleAppleSignIn = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      dispatchToWebView({ type: 'appleSignInError', errorCode: 'not-ios' });
      return;
    }
    try {
      // rawNonce を生成し、SHA256 ハッシュを Apple に渡す
      const rawNonce = Array.from(
        { length: 32 },
        () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[
          Math.floor(Math.random() * 62)
        ]
      ).join('');
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (credential.identityToken) {
        dispatchToWebView({
          type: 'appleCredential',
          identityToken: credential.identityToken,
          rawNonce,
          fullName: credential.fullName?.givenName || '',
        });
      } else {
        dispatchToWebView({ type: 'appleSignInError', errorCode: 'no-token' });
      }
    } catch (e) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        dispatchToWebView({
          type: 'appleSignInError',
          errorCode: e.code || 'unknown',
          errorMessage: e.message || '',
        });
      } else {
        // キャンセル時はボタンを再有効化するためのイベントを送る
        dispatchToWebView({ type: 'appleSignInCanceled' });
      }
    }
  }, [dispatchToWebView]);

  // WebViewからのメッセージ処理
  const onMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      // Typed haptics — iOS: expo-haptics (Taptic Engine), Android: Vibration pattern
      if (msg.type === 'haptic') {
        const isIOS = Platform.OS === 'ios';
        const { style } = msg;
        const now = Date.now();
        const minGap = style === 'coin' ? 45 : (style === 'jump' || style === 'flip' ? 28 : 18);
        const gate = hapticGateRef.current;
        if (gate.style === style && now - gate.at < minGap) return;
        gate.style = style;
        gate.at = now;

        // Native gate: limits actual Taptic Engine calls (inc. setTimeout chains) to 1 per 35ms
        const H = (fn) => { const n=Date.now(); if(n-hapticNativeRef.current<35)return; hapticNativeRef.current=n; fn(); };

        // Android: Vibration.vibrate | iOS: selectionAsync for frequent events, impactAsync for rare
        switch (style) {

          case 'flip':
            if (isIOS) {
              H(() => Haptics.selectionAsync()); // lighter than impactAsync — designed for rapid input
            } else {
              Vibration.vibrate(35);
            }
            break;

          case 'jump':
            if (isIOS) {
              H(() => Haptics.selectionAsync());
            } else {
              Vibration.vibrate(20);
            }
            break;

          case 'coin':
            if (isIOS) {
              H(() => Haptics.selectionAsync()); // most frequent — must be lightest
            } else {
              Vibration.vibrate(15);
            }
            break;

          case 'bigcoin':
            if (isIOS) {
              H(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
            } else {
              Vibration.vibrate([0, 40, 30, 40]);
            }
            break;

          case 'stomp':
            if (isIOS) {
              H(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
            } else {
              Vibration.vibrate(80);
            }
            break;

          case 'stomp_heavy':
            if (isIOS) {
              H(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
              setTimeout(() => H(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)), 90);
            } else {
              Vibration.vibrate([0, 80, 50, 100]);
            }
            break;

          case 'hurt':
            if (isIOS) {
              H(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
            } else {
              Vibration.vibrate([0, 50, 30, 50, 30, 50]);
            }
            break;

          case 'death':
            if (isIOS) {
              H(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
              setTimeout(() => H(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)), 150);
            } else {
              Vibration.vibrate([0, 100, 40, 80, 40, 150]);
            }
            break;

          case 'item':
            if (isIOS) {
              H(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
            } else {
              Vibration.vibrate([0, 30, 20, 60]);
            }
            break;

          case 'bomb':
            if (isIOS) {
              H(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
              setTimeout(() => H(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)), 90);
              setTimeout(() => H(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)), 200);
            } else {
              Vibration.vibrate([0, 120, 40, 80, 40, 40]);
            }
            break;

          case 'milestone':
            if (isIOS) {
              H(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
            } else {
              Vibration.vibrate([0, 40, 20, 40, 20, 80]);
            }
            break;

          case 'newhi':
            if (isIOS) {
              H(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
              setTimeout(() => H(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)), 220);
            } else {
              Vibration.vibrate([0, 60, 30, 60, 30, 100]);
            }
            break;

          case 'chest':
            if (isIOS) {
              H(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
              setTimeout(() => H(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)), 160);
            } else {
              Vibration.vibrate([0, 100, 60, 60]);
            }
            break;

          case 'chest_normal':
            if (isIOS) {
              H(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
              setTimeout(() => H(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)), 80);
            } else {
              Vibration.vibrate([0, 18, 35, 22]);
            }
            break;

          case 'chest_rare':
            if (isIOS) {
              H(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
              setTimeout(() => H(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)), 120);
              setTimeout(() => H(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)), 260);
            } else {
              Vibration.vibrate([0, 55, 45, 90, 40, 45]);
            }
            break;

          case 'chest_super':
            if (isIOS) {
              H(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
              setTimeout(() => H(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)), 110);
              setTimeout(() => H(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)), 300);
            } else {
              Vibration.vibrate([0, 100, 50, 100, 50, 80, 30, 60]);
            }
            break;

          // ボス警告: 10連→4連に削減（35ms native gate でさらにフィルタ）
          case 'boss_warn':
            if (isIOS) {
              H(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
              setTimeout(() => H(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)), 600);
              setTimeout(() => H(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)), 1200);
              setTimeout(() => H(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)), 1800);
            } else {
              // Android: continuous pattern — ON:80ms OFF:120ms × 5 tones, then rapid siren, then big hit
              Vibration.vibrate([
                0,
                80, 220,  // tone 1 (t=0)
                80, 220,  // tone 2 (t=0.3s)
                80, 220,  // tone 3 (t=0.6s)
                80, 220,  // tone 4 (t=0.9s)
                80, 120,  // tone 5 (t=1.2s)
                50, 80,   // siren start (t=1.35s)
                50, 80,   // siren mid   (t=1.5s)
                50, 80,   // siren peak  (t=1.65s)
                150,      // final heavy impact (t=1.8s)
              ]);
            }
            break;

          default:
            if (isIOS) {
              H(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
            } else {
              Vibration.vibrate(50);
            }
            break;
        }
      }

      // Legacy pattern vibrate (from navigator.vibrate in BRIDGE_JS)
      if (msg.type === 'vibrate') {
        const pattern = msg.pattern || [50];
        if (Platform.OS === 'android') {
          Vibration.vibrate([0, ...pattern]);
        } else {
          const n = Date.now();
          if (n - hapticNativeRef.current < 35) return;
          hapticNativeRef.current = n;
          const total = pattern.reduce((a, b) => a + b, 0);
          const style = total >= 150 ? Haptics.ImpactFeedbackStyle.Heavy
                      : total >= 60  ? Haptics.ImpactFeedbackStyle.Medium
                      : Haptics.ImpactFeedbackStyle.Light;
          Haptics.impactAsync(style);
        }
      }

      if (msg.type === 'googleSignIn') {
        googlePromptAsync();
      }
      if (msg.type === 'appleSignIn') {
        handleAppleSignIn();
      }
    } catch (e) {}
  }, [googlePromptAsync, handleAppleSignIn]);

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: GAME_URL }}
      style={{ flex: 1, backgroundColor: '#0a0a2e' }}
      originWhitelist={['https://*', 'http://*']}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      mediaPlaybackRequiresUserAction={false}
      allowsInlineMediaPlayback={true}
      injectedJavaScript={BRIDGE_JS}
      onMessage={onMessage}
      onLoad={fireReady}
      onError={fireReady}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      textInteractionEnabled={true}
      allowsBackForwardNavigationGestures={false}
      setSupportMultipleWindows={false}
    />
  );
}
