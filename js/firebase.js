'use strict';
// ===== FIREBASE INTEGRATION =====
// Provides authentication (Anonymous + Google) and Firestore cloud save/rankings.
// Falls back gracefully if Firebase SDK fails to load.

const FB_ENABLED = typeof firebase !== 'undefined';

if (!FB_ENABLED) {
  console.warn('[Firebase] SDK not loaded – local-only mode');
}

// --- Init ---
const fbApp  = FB_ENABLED ? firebase.initializeApp({
  apiKey: "AIzaSyB2bAikCJG2ZOKKea4UBg70iUawmb4XWQ8",
  authDomain: "gravity-dash-cdce1.firebaseapp.com",
  projectId: "gravity-dash-cdce1",
  storageBucket: "gravity-dash-cdce1.firebasestorage.app",
  messagingSenderId: "4638520393",
  appId: "1:4638520393:web:bdeac9e2994b8d87de7b98"
}) : null;
const fbAuth = FB_ENABLED ? firebase.auth() : null;
const fbDb   = FB_ENABLED ? firebase.firestore() : null;

// --- State ---
let fbUser = null;   // current firebase.User
let fbReady = false; // auth state resolved at least once
let fbCloudData = null;
let fbLoginMethod = localStorage.getItem('gd5loginMethod') || ''; // 'google' | 'anonymous' | ''

// --- Auth helpers ---
function fbSignInAnonymous() {
  if (!fbAuth) return Promise.reject('no-firebase');
  return fbAuth.signInAnonymously();
}
function fbSignInGoogle() {
  if (!fbAuth) return Promise.reject('no-firebase');
  const provider = new firebase.auth.GoogleAuthProvider();
  return fbAuth.signInWithPopup(provider);
}
function fbSignOut() {
  if (!fbAuth) return Promise.resolve();
  return fbAuth.signOut();
}

// --- Auth state listener ---
const _fbAuthReadyCallbacks = [];
function fbOnReady(cb) { if (fbReady) cb(fbUser); else _fbAuthReadyCallbacks.push(cb); }

if (fbAuth) {
  fbAuth.onAuthStateChanged(user => {
    fbUser = user;
    const wasReady = fbReady;
    fbReady = true;
    if (user) {
      console.log('[Firebase] Signed in:', user.uid, user.isAnonymous ? '(guest)' : '(Google)');
      fbLoginMethod = user.isAnonymous ? 'anonymous' : 'google';
      localStorage.setItem('gd5loginMethod', fbLoginMethod);
    } else {
      console.log('[Firebase] No user');
    }
    if (!wasReady) _fbAuthReadyCallbacks.forEach(cb => cb(user));
    _fbAuthReadyCallbacks.length = 0;
  });
} else {
  fbReady = true;
}

// --- Firestore: save user data (debounced) ---
let _fbSaveTimer = null;
function fbSaveUserData() {
  if (!fbDb || !fbUser) return;
  clearTimeout(_fbSaveTimer);
  _fbSaveTimer = setTimeout(_fbDoSave, 1200);
}
function _fbDoSave() {
  if (!fbDb || !fbUser) return;
  const uid = fbUser.uid;
  const data = {
    name: playerName || '',
    highScore: highScore || 0,
    character: selChar || 0,
    wallet: walletCoins || 0,
    unlocked: unlockedChars || [0],
    owned: ownedItems || [],
    eqSkin: equippedSkin || '',
    eqEyes: equippedEyes || '',
    eqFx: equippedEffect || '',
    plays: played || 0,
    tutorialDone: tutorialDone || false,
    chestTotal: totalChestsOpened || 0,
    storedChests: storedChests || 0,
    packProgress: packProgress || {},
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  fbDb.collection('users').doc(uid).set(data, { merge: true })
    .catch(e => console.warn('[Firebase] Save error:', e));
  // Update ranking entry
  if (highScore > 0) {
    fbDb.collection('rankings').doc(uid).set({
      name: playerName || '',
      charIdx: selChar || 0,
      score: highScore,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(e => console.warn('[Firebase] Ranking save error:', e));
  }
}
// Force-flush on page hide / unload
function _fbFlushSave() { clearTimeout(_fbSaveTimer); _fbDoSave(); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') _fbFlushSave(); });
window.addEventListener('beforeunload', _fbFlushSave);

// --- Firestore: load user data ---
function fbLoadUserData() {
  if (!fbDb || !fbUser) return Promise.resolve(null);
  return fbDb.collection('users').doc(fbUser.uid).get()
    .then(doc => doc.exists ? doc.data() : null)
    .catch(e => { console.warn('[Firebase] Load error:', e); return null; });
}

// --- Merge cloud data into local state ---
function fbMergeCloudData(data) {
  if (!data) return;
  // Name
  if (data.name) { playerName = data.name; localStorage.setItem('gd5username', playerName); }
  // Prefer whichever is higher/more for numeric values
  if ((data.highScore || 0) > highScore) { highScore = data.highScore; localStorage.setItem('gd5hi', highScore.toString()); }
  if ((data.wallet || 0) > walletCoins) { walletCoins = data.wallet; localStorage.setItem('gd5wallet', walletCoins.toString()); }
  if ((data.plays || 0) > played) { played = data.plays; localStorage.setItem('gd5plays', played.toString()); }
  if ((data.chestTotal || 0) > totalChestsOpened) { totalChestsOpened = data.chestTotal; localStorage.setItem('gd5chestTotal', totalChestsOpened.toString()); }
  if ((data.storedChests || 0) > storedChests) { storedChests = data.storedChests; localStorage.setItem('gd5storedChests', storedChests.toString()); }
  // Merge arrays (union)
  if (data.unlocked && data.unlocked.length) {
    unlockedChars = [...new Set([...unlockedChars, ...data.unlocked])];
    localStorage.setItem('gd5unlocked', JSON.stringify(unlockedChars));
  }
  if (data.owned && data.owned.length) {
    ownedItems = [...new Set([...ownedItems, ...data.owned])];
    localStorage.setItem('gd5owned', JSON.stringify(ownedItems));
  }
  // Cosmetics
  if (data.eqSkin) { equippedSkin = data.eqSkin; localStorage.setItem('gd5eqSkin', data.eqSkin); }
  if (data.eqEyes) { equippedEyes = data.eqEyes; localStorage.setItem('gd5eqEyes', data.eqEyes); }
  if (data.eqFx)   { equippedEffect = data.eqFx;  localStorage.setItem('gd5eqFx', data.eqFx); }
  // Character
  if (data.character !== undefined) { selChar = data.character; localStorage.setItem('gd5char', selChar.toString()); }
  // Tutorial
  if (data.tutorialDone) { tutorialDone = true; localStorage.setItem('gd5tutorialDone', '1'); }
  // Pack progress (merge, keep best stars)
  if (data.packProgress) {
    for (const k in data.packProgress) {
      if (!packProgress[k] || (data.packProgress[k].stars || 0) > (packProgress[k].stars || 0)) {
        packProgress[k] = data.packProgress[k];
      }
    }
    localStorage.setItem('gd5pp', JSON.stringify(packProgress));
    totalStars = getTotalStars();
  }
  rebuildRankingData();
}

// --- Firestore: load rankings ---
let _fbRankCache = null;
let _fbRankCacheT = 0;
function fbLoadRankings() {
  if (!fbDb || !fbUser) return Promise.resolve(null);
  const now = Date.now();
  if (_fbRankCache && now - _fbRankCacheT < 30000) return Promise.resolve(_fbRankCache);
  return fbDb.collection('rankings').orderBy('score', 'desc').limit(100).get()
    .then(snap => {
      const arr = [];
      snap.forEach(doc => {
        const d = doc.data();
        arr.push({ name: d.name || '???', charIdx: d.charIdx || 0, score: d.score || 0, isPlayer: doc.id === fbUser.uid });
      });
      _fbRankCache = arr;
      _fbRankCacheT = now;
      return arr;
    })
    .catch(e => { console.warn('[Firebase] Rankings load error:', e); return null; });
}

// Build RANKING_DATA from cloud data (called when ranking overlay opens)
function fbRefreshRankings() {
  fbLoadRankings().then(cloud => {
    if (!cloud || cloud.length === 0) { rebuildRankingData(); return; }
    const data = cloud.map(d => ({ ...d }));
    // Ensure the player appears
    if (!data.some(d => d.isPlayer) && highScore > 0) {
      data.push({ name: playerName || 'あなた', charIdx: selChar, score: highScore, isPlayer: true });
    }
    data.sort((a, b) => b.score - a.score);
    RANKING_DATA = data.slice(0, 100);
    RANKING_DATA.forEach((d, i) => d.rank = i + 1);
  });
}

// --- Firestore: delete user data (for data reset) ---
function fbDeleteUserData() {
  if (!fbDb || !fbUser) return Promise.resolve();
  const uid = fbUser.uid;
  return Promise.all([
    fbDb.collection('users').doc(uid).delete().catch(() => {}),
    fbDb.collection('rankings').doc(uid).delete().catch(() => {})
  ]).then(() => fbSignOut());
}
