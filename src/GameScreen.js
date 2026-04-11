import React, { useRef, useEffect, useCallback } from 'react';
import { BackHandler, Platform, AppState } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Haptics from 'expo-haptics';

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
    } catch(err) {}
  });
  true;
})();
`;

export default function GameScreen({ onReady }) {
  const webViewRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const readyFired = useRef(false);

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

  // WebViewからのメッセージ処理
  const onMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'vibrate') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (e) {}
  }, []);

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: GAME_URL }}
      style={{ flex: 1, backgroundColor: '#0a0a2e' }}
      originWhitelist={['*']}
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
