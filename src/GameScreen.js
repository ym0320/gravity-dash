import React, { useRef, useEffect, useCallback } from 'react';
import { BackHandler, Platform, AppState } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';

WebBrowser.maybeCompleteAuthSession();

// ★ Firebase Console → Authentication → Sign-in method → Google →
//   「ウェブクライアントID」をここに貼り付けてください
const GOOGLE_WEB_CLIENT_ID = '4638520393-1bt3sfjolepmga5ema4o3g9nh8lbp54d.apps.googleusercontent.com';

// ★ Google Cloud Console → 認証情報 → OAuth 2.0 クライアントID → iOS →
//   バンドルID「com.ym0320.gGravHopper」でiOS用クライアントIDを作成して貼り付ける
//   App Store公開前に必須。未設定の場合はGoogleログインがエラーになる（クラッシュはしない）
const GOOGLE_IOS_CLIENT_ID = null;

const GAME_URL = 'https://gravity-dash-cdce1.web.app/';

const BRIDGE_JS = `
(function() {
  // バイブレーションをネイティブに橋渡し
  navigator.vibrate = function(pattern) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'vibrate',
        ms: Array.isArray(pattern) ? pattern[0] : pattern
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
      if (msg.type === 'vibrate') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      textInteractionEnabled={false}
      allowsBackForwardNavigationGestures={false}
      setSupportMultipleWindows={false}
    />
  );
}
