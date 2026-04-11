import React, { useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import GameScreen from './src/GameScreen';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const splashHidden = useRef(false);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  const handleReady = useCallback(async () => {
    if (splashHidden.current) return;
    splashHidden.current = true;
    try { await SplashScreen.hideAsync(); } catch (e) {}
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <GameScreen onReady={handleReady} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a2e',
  },
});
