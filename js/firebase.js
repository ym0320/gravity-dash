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

// --- State (var for cross-script access) ---
var fbUser = null;   // current firebase.User
var fbReady = false; // auth state resolved at least once
var fbCloudData = null;
var fbSynced = false; // true after cloud merge completes (blocks saves until ready)
var _fbLastSyncedUid = ''; // uid of last successfully synced user (prevent duplicate syncs)
var fbLoginMethod = localStorage.getItem('gd5loginMethod') || ''; // 'google' | 'anonymous' | ''
var _fbGoogleLoginInProgress = false; // true while Google login handler is running
var _fbDirty = false; // true when local state has changed and needs saving

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
function fbSignInTwitter() {
  if (!fbAuth) return Promise.reject('no-firebase');
  const provider = new firebase.auth.TwitterAuthProvider();
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
    console.log('[FB] onAuthStateChanged:', user ? user.uid : 'null', user ? (user.isAnonymous?'anon':'provider') : '');
    fbUser = user;
    const wasReady = fbReady;
    fbReady = true;
    if (user) {
      fbLoginMethod = user.isAnonymous ? 'anonymous' :
        (user.providerData && user.providerData.some(p => p.providerId === 'twitter.com')) ? 'twitter' : 'google';
      localStorage.setItem('gd5loginMethod', fbLoginMethod);
      if (_fbGoogleLoginInProgress) {
        // Google login handler manages sync
      } else if (_fbLastSyncedUid === user.uid && fbSynced) {
        // Already synced
      } else {
        fbSynced = false;
        console.log('[FB] loading user data...');
        fbLoadUserData().then(data => {
          console.log('[FB] loaded:', data ? 'has data' : 'no data');
          if (data && data.name) fbMergeCloudData(data);
          fbSynced = true;
          _fbLastSyncedUid = user.uid;
          // Update ranking entry with current cosmetics
          if (playerName) {
            const rc = rankChar >= 0 ? rankChar : selChar || 0;
            fbDb.collection('rankings').doc(user.uid).set({
              name: playerName, charIdx: rc, score: highScore || 0,
              eqSkin: rankSkin || '', eqEyes: rankEyes || '', eqFx: rankFx || '',
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(e => console.error('[Firebase] ranking update error:', e));
          }
          const pn = playerName || localStorage.getItem('gd5username');
          if (pn) {
            if (!playerName) playerName = pn;
            _fbDirty = true;
            _fbDoSave();
          }
          // Flush any saves that were queued while syncing
          if (_fbPendingSave) {
            _fbPendingSave = false;
            _fbDirty = true;
            _fbDoSave();
          }
        }).catch(() => {
          fbSynced = true;
          if (_fbPendingSave) { _fbPendingSave = false; _fbDirty = true; _fbDoSave(); }
        });
      }
    } else {
      const existingName = localStorage.getItem('gd5username');
      if (existingName) {
        fbAuth.signInAnonymously().catch(e => console.warn('[Firebase] Auto-connect failed:', e));
        return; // onAuthStateChanged will fire again with the new user
      }
    }
    if (!wasReady) _fbAuthReadyCallbacks.forEach(cb => cb(user));
    _fbAuthReadyCallbacks.length = 0;
  });
} else {
  fbReady = true;
}

// --- Firestore: save user data (debounced) ---
var _fbSaveTimer = null;
var _fbPendingSave = false; // true when save was requested but fbSynced was false
var _fbPendingRetryTimer = null;
function fbSaveUserData() {
  console.log('[FB] saveUserData called, db=',!!fbDb,'user=',!!fbUser,'synced=',fbSynced);
  if (!fbDb || !fbUser) return;
  _fbDirty = true;
  if (!fbSynced) {
    _fbPendingSave = true;
    // Retry after delay in case sync completes
    if (!_fbPendingRetryTimer) {
      _fbPendingRetryTimer = setTimeout(function _retryPending() {
        _fbPendingRetryTimer = null;
        if (_fbPendingSave && fbSynced) {
          _fbPendingSave = false;
          _fbDoSave();
        } else if (_fbPendingSave) {
          _fbPendingRetryTimer = setTimeout(_retryPending, 500);
        }
      }, 500);
    }
    return;
  }
  clearTimeout(_fbSaveTimer);
  _fbSaveTimer = setTimeout(_fbDoSave, 1200);
}
function _fbDoSave() {
  console.log('[FB] _doSave called, db=',!!fbDb,'user=',!!fbUser,'dirty=',_fbDirty,'name=',playerName);
  if (!fbDb || !fbUser || !_fbDirty) return;
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
    rankChar: rankChar >= 0 ? rankChar : -1,
    rankSkin: rankSkin || '',
    rankEyes: rankEyes || '',
    rankFx: rankFx || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  _fbDirty = false;
  fbDb.collection('users').doc(uid).set(data, { merge: true })
    .catch(e => console.error('[Firebase] users/ SAVE FAILED:', e));
  // Update ranking entry – always save if name exists (even score 0 for visibility)
  if (playerName) {
    const sc = highScore || 0;
    const rc = rankChar >= 0 ? rankChar : selChar || 0;
    fbDb.collection('rankings').doc(uid).set({
      name: playerName,
      charIdx: rc,
      score: sc,
      eqSkin: rankSkin || '',
      eqEyes: rankEyes || '',
      eqFx: rankFx || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true })
      .catch(e => console.error('[Firebase] rankings/ SAVE FAILED:', e));
  }
}
// Force-flush on page hide / unload; re-sync on page visible (title only)
function _fbFlushSave() { clearTimeout(_fbSaveTimer); _fbPendingSave=false; _fbDoSave(); }
function _fbResync() {
  if (!fbDb || !fbUser || !fbSynced) return;
  // Only re-sync on title screen so in-game progress is not overwritten
  if (typeof state !== 'undefined' && state !== ST.TITLE) return;
  fbLoadUserData().then(data => { if (data) fbMergeCloudData(data); });
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') _fbFlushSave();
  else if (document.visibilityState === 'visible') _fbResync();
});
window.addEventListener('beforeunload', _fbFlushSave);

// --- Firestore: load user data ---
// Optional uid parameter to load a specific user's data (e.g. right after Google sign-in)
function fbLoadUserData(uid) {
  const id = uid || (fbUser ? fbUser.uid : null);
  if (!fbDb || !id) return Promise.resolve(null);
  return fbDb.collection('users').doc(id).get()
    .then(doc => doc.exists ? doc.data() : null)
    .catch(e => { console.warn('[Firebase] Load error:', e); return null; });
}

// --- Merge cloud data into local state ---
// Cloud is authoritative – always overwrite local with cloud values
function fbMergeCloudData(data) {
  if (!data) return;
  _fbDirty = false; // cloud data merged – no local changes to save
  // Name
  if (data.name) { playerName = data.name; localStorage.setItem('gd5username', playerName); }
  // Cloud wins for all numeric values
  if (data.highScore !== undefined) { highScore = data.highScore; localStorage.setItem('gd5hi', highScore.toString()); }
  if (data.wallet !== undefined) { walletCoins = data.wallet; localStorage.setItem('gd5wallet', walletCoins.toString()); }
  if (data.plays !== undefined) { played = data.plays; localStorage.setItem('gd5plays', played.toString()); }
  if (data.chestTotal !== undefined) { totalChestsOpened = data.chestTotal; localStorage.setItem('gd5chestTotal', totalChestsOpened.toString()); }
  if (data.storedChests !== undefined) { storedChests = data.storedChests; localStorage.setItem('gd5storedChests', storedChests.toString()); }
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
  // Ranking cosmetics (captured at time of high score)
  if (data.rankChar !== undefined) { rankChar = data.rankChar; localStorage.setItem('gd5rankChar', rankChar.toString()); }
  if (data.rankSkin !== undefined) { rankSkin = data.rankSkin; localStorage.setItem('gd5rankSkin', rankSkin); }
  if (data.rankEyes !== undefined) { rankEyes = data.rankEyes; localStorage.setItem('gd5rankEyes', rankEyes); }
  if (data.rankFx !== undefined) { rankFx = data.rankFx; localStorage.setItem('gd5rankFx', rankFx); }
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
var _fbRankCache = null;
var _fbRankCacheT = 0;
function fbLoadRankings() {
  if (!fbDb || !fbUser) return Promise.resolve(null);
  const now = Date.now();
  if (_fbRankCache && now - _fbRankCacheT < 30000) return Promise.resolve(_fbRankCache);
  return fbDb.collection('rankings').orderBy('score', 'desc').limit(100).get()
    .then(snap => {
      const arr = [];
      snap.forEach(doc => {
        const d = doc.data();
        arr.push({ name: d.name || '???', charIdx: d.charIdx || 0, score: d.score || 0,
          eqSkin: d.eqSkin || '', eqEyes: d.eqEyes || '', eqFx: d.eqFx || '',
          isPlayer: doc.id === fbUser.uid });
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
      const rc = rankChar >= 0 ? rankChar : selChar || 0;
      data.push({ name: playerName || 'あなた', charIdx: rc, score: highScore,
        eqSkin: rankSkin || '', eqEyes: rankEyes || '', eqFx: rankFx || '', isPlayer: true });
    }
    data.sort((a, b) => b.score - a.score);
    RANKING_DATA = data.slice(0, 100);
    RANKING_DATA.forEach((d, i) => d.rank = i + 1);
  });
}

// --- Firestore: check if name is already taken (by another user) ---
function fbCheckNameExists(name) {
  if (!fbDb || !fbUser) return Promise.resolve(false);
  return fbDb.collection('users').where('name', '==', name).limit(1).get()
    .then(snap => {
      if (snap.empty) return false;
      let taken = false;
      snap.forEach(doc => { if (doc.id !== (fbUser ? fbUser.uid : '')) taken = true; });
      return taken;
    })
    .catch(e => { console.warn('[Firebase] Name check error:', e); return false; });
}

// --- Firestore: find user data by name and migrate to current Google UID ---
// Used when Google login has no data but an old anonymous account exists
function fbFindAndMigrateByName(name) {
  if (!fbDb || !fbUser) return Promise.resolve(null);
  return fbDb.collection('users').where('name', '==', name).limit(1).get()
    .then(snap => {
      if (snap.empty) return null;
      let found = null;
      let oldDocId = null;
      snap.forEach(doc => { found = doc.data(); oldDocId = doc.id; });
      if (!found) return null;
      const newUid = fbUser.uid;
      if (oldDocId === newUid) return found;
      return fbDb.collection('users').doc(newUid).set(found, { merge: true }).then(() => {
        // Migrate ranking entry and clean up old documents
        return fbDb.collection('rankings').doc(oldDocId).get().then(rdoc => {
          if (rdoc.exists) {
            return fbDb.collection('rankings').doc(newUid).set(rdoc.data(), { merge: true }).then(() => {
              fbDb.collection('rankings').doc(oldDocId).delete().catch(() => {});
            });
          }
        }).then(() => {
          // Delete old user document to prevent ghost data / duplicate rankings
          fbDb.collection('users').doc(oldDocId).delete().catch(() => {});
        });
      }).then(() => found);
    })
    .catch(e => { console.warn('[Firebase] Migration error:', e); return null; });
}

// --- Force save (callable from other files) ---
function fbForceSave() {
  _fbDirty = true;
  if (fbSynced) { _fbDoSave(); }
  else { _fbPendingSave = true; } // will flush after sync completes
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
