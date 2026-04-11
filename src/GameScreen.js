import React, { useRef, useEffect, useCallback } from 'react';
import { BackHandler, Platform, AppState, Vibration } from 'react-native';
import Constants from 'expo-constants';
import { WebView } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';

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

  // Apple Sign-In (iOS native)
  const handleAppleSignIn = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'appleSignInError' }));
      return;
    }
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        webViewRef.current?.postMessage(JSON.stringify({
          type: 'appleCredential',
          identityToken: credential.identityToken,
          fullName: credential.fullName?.givenName || '',
        }));
      } else {
        webViewRef.current?.postMessage(JSON.stringify({ type: 'appleSignInError' }));
      }
    } catch (e) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        webViewRef.current?.postMessage(JSON.stringify({ type: 'appleSignInError' }));
      }
    }
  }, []);

  // WebViewからのメッセージ処理
  const onMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      // Typed haptics — iOS: expo-haptics (Taptic Engine), Android: Vibration pattern
      if (msg.type === 'haptic') {
        const isIOS = Platform.OS === 'ios';
        const { style } = msg;

        // Android: use Vibration.vibrate with distinct duration patterns
        // iOS: use expo-haptics Taptic Engine for crisp distinct feedback
        switch (style) {

          case 'flip':
            if (isIOS) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
            } else {
              Vibration.vibrate(35); // short, sharp
            }
            break;

          case 'jump':
            if (isIOS) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } else {
              Vibration.vibrate(20);
            }
            break;

          case 'coin':
            if (isIOS) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } else {
              Vibration.vibrate(15); // very short tick
            }
            break;

          case 'bigcoin':
            if (isIOS) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } else {
              Vibration.vibrate([0, 40, 30, 40]); // double pulse
            }
            break;

          case 'stomp':
            if (isIOS) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            } else {
              Vibration.vibrate(80); // solid thud
            }
            break;

          case 'stomp_heavy':
            if (isIOS) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 90);
            } else {
              Vibration.vibrate([0, 80, 50, 100]); // double heavy
            }
            break;

          case 'hurt':
            if (isIOS) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } else {
              Vibration.vibrate([0, 50, 30, 50, 30, 50]); // warning triple buzz
            }
            break;

          case 'death':
            if (isIOS) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 150);
            } else {
              Vibration.vibrate([0, 100, 40, 80, 40, 150]); // error crescendo
            }
            break;

          case 'item':
            if (isIOS) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
              Vibration.vibrate([0, 30, 20, 60]); // short-long success
            }
            break;

          case 'bomb':
            if (isIOS) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 90);
              setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 200);
            } else {
              Vibration.vibrate([0, 120, 40, 80, 40, 40]); // explosion decay
            }
            break;

          case 'milestone':
            if (isIOS) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
              Vibration.vibrate([0, 40, 20, 40, 20, 80]); // build-up
            }
            break;

          case 'newhi':
            if (isIOS) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 220);
            } else {
              Vibration.vibrate([0, 60, 30, 60, 30, 100]); // double achievement
            }
            break;

          case 'chest':
            if (isIOS) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 160);
            } else {
              Vibration.vibrate([0, 100, 60, 60]); // thunk + follow
            }
            break;

          case 'chest_super':
            if (isIOS) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 110);
              setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 300);
            } else {
              Vibration.vibrate([0, 100, 50, 100, 50, 80, 30, 60]); // epic reveal
            }
            break;

          // ボス警告: SEと完全同期した2秒間の段階的振動
          // SE構造: 5つの降下音 (0, 0.3, 0.6, 0.9, 1.2秒) + サイレン上昇 + 重撃 (1.8秒)
          case 'boss_warn':
            if (isIOS) {
              // 5 heavy taps matching descending tones, then siren pulses, final impact
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 300);
              setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 600);
              setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 900);
              setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 1200);
              // Siren phase: rapid light pulses building up
              setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 1350);
              setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 1500);
              setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 1650);
              // Final impact
              setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), 1800);
              setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 1950);
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
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
