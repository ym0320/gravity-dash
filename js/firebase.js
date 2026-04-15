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
var fbLoginMethod = localStorage.getItem('gd5loginMethod') || ''; // 'google' | 'apple' | 'anonymous' | ''
var _fbGoogleLoginInProgress = false; // true while social login handler is running
var _fbDirty = false; // true when local state has changed and needs saving
var _fbRedirectPending = false; // true while getRedirectResult() is resolving

// --- Auth helpers ---
function fbSignInAnonymous() {
  if (!fbAuth) return Promise.reject('no-firebase');
  return fbAuth.signInAnonymously();
}
// Native bridge: RNからのGoogleトークンでサインイン
function fbSignInWithGoogleIdToken(idToken) {
  if (!fbAuth) return Promise.reject('no-firebase');
  const credential = firebase.auth.GoogleAuthProvider.credential(idToken);
  return fbAuth.signInWithCredential(credential);
}
// Native bridge: RNからのAppleトークンでサインイン
function fbSignInWithAppleToken(identityToken) {
  if (!fbAuth) return Promise.reject('no-firebase');
  const provider = new firebase.auth.OAuthProvider('apple.com');
  const credential = provider.credential({ idToken: identityToken });
  return fbAuth.signInWithCredential(credential);
}
// Fallback: redirect (not used in RN app, kept for web)
function fbSignInGoogle() {
  if (!fbAuth) return Promise.reject('no-firebase');
  const provider = new firebase.auth.GoogleAuthProvider();
  return fbAuth.signInWithRedirect(provider);
}
function fbSignInApple() {
  if (!fbAuth) return Promise.reject('no-firebase');
  const provider = new firebase.auth.OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  return fbAuth.signInWithRedirect(provider);
}
// Link anonymous account to a provider via redirect (keeps same UID & data)
function fbLinkGoogle() {
  if (!fbAuth || !fbUser) return Promise.reject('no-user');
  localStorage.setItem('gd5pendingLink', 'google');
  const p = new firebase.auth.GoogleAuthProvider();
  return fbUser.linkWithRedirect(p);
}
function fbLinkApple() {
  if (!fbAuth || !fbUser) return Promise.reject('no-user');
  localStorage.setItem('gd5pendingLink', 'apple');
  const p = new firebase.auth.OAuthProvider('apple.com');
  p.addScope('email'); p.addScope('name');
  return fbUser.linkWithRedirect(p);
}
function fbSignOut() {
  if (!fbAuth) return Promise.resolve();
  return fbAuth.signOut();
}
// Handle auth/credential-already-in-use: sign in as existing user & migrate anon data
function fbHandleCredentialInUse(credential, providerName) {
  if (!fbAuth) return Promise.reject('no-firebase');
  const oldUid = (fbUser && fbUser.isAnonymous) ? fbUser.uid : null;
  _fbGoogleLoginInProgress = true;
  return fbAuth.signInWithCredential(credential).then(result => {
    fbUser = result.user;
    fbLoginMethod = providerName;
    localStorage.setItem('gd5loginMethod', providerName);
    const newUid = result.user.uid;
    // Check if the target user already has cloud data
    return fbLoadUserData(newUid).then(existingData => {
      if (existingData && existingData.name) {
        // Target user has data — use it, just clean up anon
        if (oldUid && fbDb) {
          fbDb.collection('users').doc(oldUid).delete().catch(() => {});
          fbDb.collection('rankings').doc(oldUid).delete().catch(() => {});
        }
        _fbGoogleLoginInProgress = false;
        return existingData;
      }
      // Target user has no data — migrate from anonymous
      if (oldUid && fbDb) {
        return fbDb.collection('users').doc(oldUid).get().then(doc => {
          if (!doc.exists) { _fbGoogleLoginInProgress = false; return null; }
          const anonData = doc.data();
          // Copy user data to new UID
          return fbDb.collection('users').doc(newUid).set(anonData).then(() => {
            // Copy ranking data too
            return fbDb.collection('rankings').doc(oldUid).get().then(rDoc => {
              if (rDoc.exists) {
                return fbDb.collection('rankings').doc(newUid).set(rDoc.data());
              }
            });
          }).then(() => {
            // Delete old anonymous documents
            fbDb.collection('users').doc(oldUid).delete().catch(() => {});
            fbDb.collection('rankings').doc(oldUid).delete().catch(() => {});
            _fbGoogleLoginInProgress = false;
            return anonData;
          });
        }).catch(() => { _fbGoogleLoginInProgress = false; return null; });
      }
      _fbGoogleLoginInProgress = false;
      return null;
    });
  }).catch(e => {
    _fbGoogleLoginInProgress = false;
    throw e;
  });
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
      fbLoginMethod = user.isAnonymous ? 'anonymous' :
        (user.providerData && user.providerData.some(p => p.providerId === 'apple.com')) ? 'apple' :
        (user.providerData && user.providerData.some(p => p.providerId === 'twitter.com')) ? 'twitter' : 'google';
      localStorage.setItem('gd5loginMethod', fbLoginMethod);
      if (_fbGoogleLoginInProgress) {
        // Google login handler manages sync
      } else if (_fbLastSyncedUid === user.uid && fbSynced) {
        // Already synced
      } else {
        fbSynced = false;
        fbLoadUserData().then(data => {
          if (data && data.name) fbMergeCloudData(data);
          fbSynced = true;
          _fbLastSyncedUid = user.uid;
          // Update ranking entries with current cosmetics (only if played at least once)
          if (playerName && played > 0) {
            const rc = rankChar >= 0 ? rankChar : selChar || 0;
            fbDb.collection('rankings').doc(user.uid).set({
              name: playerName, charIdx: rc, score: highScore || 0,
              eqSkin: rankSkin || '', eqEyes: rankEyes || '', eqFx: rankFx || '',
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(e => console.error('[Firebase] ranking update error:', e));
            // Challenge ranking (only if played)
            const crc = challRankChar >= 0 ? challRankChar : selChar || 0;
            fbDb.collection('challengeRankings').doc(user.uid).set({
              name: playerName, charIdx: crc, kills: challengeBestKills || 0,
              eqSkin: challRankSkin || '', eqEyes: challRankEyes || '', eqFx: challRankFx || '',
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(e => console.error('[Firebase] chall ranking update error:', e));
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

// --- Redirect result handler (Google/Apple sign-in via signInWithRedirect) ---
if (fbAuth) {
  _fbRedirectPending = true;
  fbAuth.getRedirectResult().then(result => {
    _fbRedirectPending = false;
    if (result && result.user) {
      const providerName = (result.additionalUserInfo && result.additionalUserInfo.providerId === 'apple.com') ? 'apple' : 'google';
      fbLoginMethod = providerName;
      localStorage.setItem('gd5loginMethod', providerName);
      window.dispatchEvent(new CustomEvent('fbRedirectResult', { detail: result }));
    } else {
      // No redirect result – check for pending link
      const pendingLink = localStorage.getItem('gd5pendingLink');
      if (pendingLink) {
        localStorage.removeItem('gd5pendingLink');
        window.dispatchEvent(new CustomEvent('fbLinkResult', { detail: { method: pendingLink } }));
      }
    }
  }).catch(e => {
    _fbRedirectPending = false;
    if (e.code && e.code !== 'auth/no-auth-event') {
      console.warn('[Firebase] getRedirectResult error:', e);
    }
  });
}

// --- Firestore: save user data (debounced) ---
var _fbSaveTimer = null;
var _fbPendingSave = false; // true when save was requested but fbSynced was false
var _fbPendingRetryTimer = null;
function fbSaveUserData() {
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
    freeRevives: freeRevivesUsed || 0,
    tutorialDone: tutorialDone || false,
    chestTotal: totalChestsOpened || 0,
    storedChests: storedChests || 0,
    packProgress: packProgress || {},
    rankChar: rankChar >= 0 ? rankChar : -1,
    rankSkin: rankSkin || '',
    rankEyes: rankEyes || '',
    rankFx: rankFx || '',
    challBestKills: challengeBestKills || 0,
    challRankChar: challRankChar >= 0 ? challRankChar : -1,
    challRankSkin: challRankSkin || '',
    challRankEyes: challRankEyes || '',
    challRankFx: challRankFx || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  _fbDirty = false;
  fbDb.collection('users').doc(uid).set(data, { merge: true })
    .catch(e => console.error('[Firebase] users/ SAVE FAILED:', e));
  // Update ranking entry – only save if player has name AND has played at least once
  if (playerName && played > 0) {
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
    // Challenge ranking (always save, even with 0 kills – same as endless)
    const ck = challengeBestKills || 0;
    const crc = challRankChar >= 0 ? challRankChar : selChar || 0;
    fbDb.collection('challengeRankings').doc(uid).set({
      name: playerName,
      charIdx: crc,
      kills: ck,
      eqSkin: challRankSkin || '',
      eqEyes: challRankEyes || '',
      eqFx: challRankFx || '',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true })
      .catch(e => console.error('[Firebase] challengeRankings/ SAVE FAILED:', e));
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
function _clampInt(v,min,max){const n=parseInt(v);if(isNaN(n))return min;return Math.max(min,Math.min(max,n));}
// Sanitize a cosmetic ID string from cloud/localStorage: must be non-empty string, max 64 chars, alphanumeric+underscore+hyphen only
function _sanitizeCosmeticId(v){if(!v||typeof v!=='string')return'';return v.replace(/[^a-zA-Z0-9_\-]/g,'').substring(0,64);}
function fbMergeCloudData(data) {
  if (!data) return;
  _fbDirty = false; // cloud data merged – no local changes to save
  // Name (sanitize)
  if (data.name && typeof data.name === 'string') { playerName = data.name.replace(/[<>&"']/g,'').substring(0,12); localStorage.setItem('gd5username', playerName); }
  // Cloud wins for all numeric values (with validation)
  if (data.highScore !== undefined) { highScore = _clampInt(data.highScore,0,99999); localStorage.setItem('gd5hi', highScore.toString()); }
  if (data.wallet !== undefined) { walletCoins = _clampInt(data.wallet,0,9999999); localStorage.setItem('gd5wallet', walletCoins.toString()); }
  if (data.plays !== undefined) { played = _clampInt(data.plays,0,999999); localStorage.setItem('gd5plays', played.toString()); }
  if (data.freeRevives !== undefined) { freeRevivesUsed = _clampInt(data.freeRevives,0,5); localStorage.setItem('gd5freeRevives', freeRevivesUsed.toString()); }
  if (data.chestTotal !== undefined) { totalChestsOpened = _clampInt(data.chestTotal,0,999999); localStorage.setItem('gd5chestTotal', totalChestsOpened.toString()); }
  if (data.storedChests !== undefined) { storedChests = _clampInt(data.storedChests,0,999); localStorage.setItem('gd5storedChests', storedChests.toString()); }
  // Merge arrays (union, with type validation)
  if (data.unlocked && Array.isArray(data.unlocked)) {
    const valid = data.unlocked.filter(v => typeof v === 'number' && v >= 0 && v <= 5);
    unlockedChars = [...new Set([...unlockedChars, ...valid])];
    localStorage.setItem('gd5unlocked', JSON.stringify(unlockedChars));
  }
  if (data.owned && Array.isArray(data.owned)) {
    // Sanitize each owned item ID to prevent arbitrary string injection
    const valid = data.owned.filter(v => typeof v === 'string').map(_sanitizeCosmeticId).filter(v => v.length > 0);
    ownedItems = [...new Set([...ownedItems, ...valid])];
    localStorage.setItem('gd5owned', JSON.stringify(ownedItems));
  }
  // Cosmetics (sanitize IDs before storing)
  if (data.eqSkin) { equippedSkin = _sanitizeCosmeticId(data.eqSkin); localStorage.setItem('gd5eqSkin', equippedSkin); }
  if (data.eqEyes) { equippedEyes = _sanitizeCosmeticId(data.eqEyes); localStorage.setItem('gd5eqEyes', equippedEyes); }
  if (data.eqFx)   { equippedEffect = _sanitizeCosmeticId(data.eqFx);  localStorage.setItem('gd5eqFx', equippedEffect); }
  // Character (clamp to valid index range 0-5)
  if (data.character !== undefined) { selChar = _clampInt(data.character,0,5); localStorage.setItem('gd5char', selChar.toString()); }
  // Ranking cosmetics (captured at time of high score)
  if (data.rankChar !== undefined) { rankChar = _clampInt(data.rankChar,-1,5); localStorage.setItem('gd5rankChar', rankChar.toString()); }
  if (data.rankSkin !== undefined) { rankSkin = _sanitizeCosmeticId(data.rankSkin); localStorage.setItem('gd5rankSkin', rankSkin); }
  if (data.rankEyes !== undefined) { rankEyes = _sanitizeCosmeticId(data.rankEyes); localStorage.setItem('gd5rankEyes', rankEyes); }
  if (data.rankFx !== undefined) { rankFx = _sanitizeCosmeticId(data.rankFx); localStorage.setItem('gd5rankFx', rankFx); }
  // Challenge best
  if (data.challBestKills !== undefined && data.challBestKills > challengeBestKills) {
    challengeBestKills = _clampInt(data.challBestKills,0,9999); localStorage.setItem('gd5challBest', challengeBestKills.toString());
  }
  if (data.challRankChar !== undefined) { challRankChar = _clampInt(data.challRankChar,-1,5); localStorage.setItem('gd5challRankChar', challRankChar.toString()); }
  if (data.challRankSkin !== undefined) { challRankSkin = _sanitizeCosmeticId(data.challRankSkin); localStorage.setItem('gd5challRankSkin', challRankSkin); }
  if (data.challRankEyes !== undefined) { challRankEyes = _sanitizeCosmeticId(data.challRankEyes); localStorage.setItem('gd5challRankEyes', challRankEyes); }
  if (data.challRankFx !== undefined) { challRankFx = _sanitizeCosmeticId(data.challRankFx); localStorage.setItem('gd5challRankFx', challRankFx); }
  // Tutorial
  if (data.tutorialDone) { tutorialDone = true; localStorage.setItem('gd5tutorialDone', '1'); }
  // Pack progress (merge, keep best stars)
  if (data.packProgress) {
    // Only merge keys that are valid known stage IDs to prevent prototype/key injection
    const _validStageIds = (typeof STAGE_PACKS !== 'undefined')
      ? new Set(STAGE_PACKS.flatMap(p => p.stages.map(s => s.id)))
      : null;
    for (const k in data.packProgress) {
      if (_validStageIds && !_validStageIds.has(k)) continue; // skip unknown stage IDs
      if (!packProgress[k] || (data.packProgress[k].stars || 0) > (packProgress[k].stars || 0)) {
        packProgress[k] = data.packProgress[k];
      }
    }
    // Force all stages unlocked with 0 stars (big coin reset)
    if(typeof STAGE_PACKS!=='undefined')STAGE_PACKS.forEach(p=>p.stages.forEach(s=>{packProgress[s.id]={cleared:true,stars:0};}));
    localStorage.setItem('gd5pp', JSON.stringify(packProgress));
    totalStars = getTotalStars();
  }
  rebuildRankingData();
}

// --- Firestore: load rankings (shared cache loader) ---
// _fbLoadRankCollection: generic ranked-collection loader with 30s cache
function _fbLoadRankCollection(collection, scoreField, cacheRef) {
  if (!fbDb || !fbUser) return Promise.resolve(null);
  const now = Date.now();
  if (cacheRef.data && now - cacheRef.t < 30000) return Promise.resolve(cacheRef.data);
  return fbDb.collection(collection).orderBy(scoreField, 'desc').limit(100).get()
    .then(snap => {
      const arr = [];
      snap.forEach(doc => {
        const d = doc.data();
        const entry = { name: d.name || '???', charIdx: d.charIdx || 0,
          eqSkin: d.eqSkin || '', eqEyes: d.eqEyes || '', eqFx: d.eqFx || '',
          isPlayer: doc.id === fbUser.uid };
        entry[scoreField] = d[scoreField] || 0;
        arr.push(entry);
      });
      cacheRef.data = arr;
      cacheRef.t = now;
      return arr;
    })
    .catch(e => { console.warn('[Firebase] Rankings load error (' + collection + '):', e); return null; });
}
var _fbRankCache = { data: null, t: 0 };
var _fbChallRankCache = { data: null, t: 0 };
function fbLoadRankings() { return _fbLoadRankCollection('rankings', 'score', _fbRankCache); }
function fbLoadChallengeRankings() { return _fbLoadRankCollection('challengeRankings', 'kills', _fbChallRankCache); }

// Build RANKING_DATA from cloud data (called when ranking overlay opens)
function fbRefreshRankings() {
  fbLoadRankings().then(cloud => {
    if (!cloud || cloud.length === 0) { rebuildRankingData(); return; }
    const data = cloud.map(d => ({ ...d }));
    if (!data.some(d => d.isPlayer) && highScore > 0) {
      const rc = rankChar >= 0 ? rankChar : selChar || 0;
      data.push({ name: playerName || t('youDefault'), charIdx: rc, score: highScore,
        eqSkin: rankSkin || '', eqEyes: rankEyes || '', eqFx: rankFx || '', isPlayer: true });
    }
    if(_DEBUG_SAMPLE_RANKING)for(let i=0;i<_SAMPLE_BASE.length;i++)data.push({name:_sampleName(i),charIdx:_SAMPLE_BASE[i].charIdx,score:_SAMPLE_BASE[i].score,eqSkin:_SAMPLE_BASE[i].eqSkin,eqEyes:_SAMPLE_BASE[i].eqEyes,eqFx:_SAMPLE_BASE[i].eqFx,isPlayer:false});
    data.sort((a, b) => b.score - a.score);
    RANKING_DATA = data.slice(0, 100);
    RANKING_DATA.forEach((d, i) => d.rank = i + 1);
  });
  fbRefreshChallengeRankings();
}

function fbRefreshChallengeRankings() {
  fbLoadChallengeRankings().then(cloud => {
    if (!cloud || cloud.length === 0) { rebuildChallengeRankingData(); return; }
    const data = cloud.map(d => ({ ...d }));
    if (!data.some(d => d.isPlayer) && challengeBestKills > 0) {
      const crc = challRankChar >= 0 ? challRankChar : selChar || 0;
      data.push({ name: playerName || t('youDefault'), charIdx: crc, kills: challengeBestKills,
        eqSkin: challRankSkin || '', eqEyes: challRankEyes || '', eqFx: challRankFx || '', isPlayer: true });
    }
    if(_DEBUG_SAMPLE_RANKING)for(let i=0;i<_SAMPLE_BASE.length;i++)data.push({name:_sampleName(i),charIdx:_SAMPLE_BASE[i].charIdx,kills:_SAMPLE_BASE[i].kills,eqSkin:_SAMPLE_BASE[i].eqSkin,eqEyes:_SAMPLE_BASE[i].eqEyes,eqFx:_SAMPLE_BASE[i].eqFx,isPlayer:false});
    data.sort((a, b) => b.kills - a.kills);
    CHALLENGE_RANKING_DATA = data.slice(0, 100);
    CHALLENGE_RANKING_DATA.forEach((d, i) => d.rank = i + 1);
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

// --- Firestore: find user data by UID and migrate to current Google UID ---
// Used when Google login has no data but an old anonymous account exists.
// Requires expectedOldUid (the previous anonymous UID) — name-based lookup removed for security.
function fbFindAndMigrateByName(name, expectedOldUid) {
  if (!fbDb || !fbUser || !expectedOldUid) return Promise.resolve(null);
  const newUid = fbUser.uid;
  if (expectedOldUid === newUid) return Promise.resolve(null);
  return fbDb.collection('users').doc(expectedOldUid).get()
    .then(doc => {
      if (!doc.exists) return null;
      const found = doc.data();
      // Verify the name matches to prevent migrating another user's account
      if (!found.name || found.name !== name) return null;
      return fbDb.collection('users').doc(newUid).set(found, { merge: true }).then(() => {
        return fbDb.collection('rankings').doc(expectedOldUid).get().then(rdoc => {
          if (rdoc.exists) {
            return fbDb.collection('rankings').doc(newUid).set(rdoc.data(), { merge: true });
          }
        }).then(() => {
          return fbDb.collection('challengeRankings').doc(expectedOldUid).get().then(crdoc => {
            if (crdoc.exists) {
              return fbDb.collection('challengeRankings').doc(newUid).set(crdoc.data(), { merge: true });
            }
          });
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
    fbDb.collection('rankings').doc(uid).delete().catch(() => {}),
    fbDb.collection('challengeRankings').doc(uid).delete().catch(() => {})
  ]).then(() => fbSignOut());
}

// --- Account deletion (Guideline 5.1.1(v)) ---
// Deletes Firestore data AND the Firebase Auth user account.
function fbDeleteAccount() {
  if (!fbUser) return Promise.reject('no-user');
  const uid = fbUser.uid;
  const user = fbUser;
  const deletions = fbDb ? [
    fbDb.collection('users').doc(uid).delete().catch(e => console.warn('[Firebase] delete users failed:', e)),
    fbDb.collection('rankings').doc(uid).delete().catch(e => console.warn('[Firebase] delete rankings failed:', e)),
    fbDb.collection('challengeRankings').doc(uid).delete().catch(e => console.warn('[Firebase] delete challengeRankings failed:', e))
  ] : [];
  return Promise.all(deletions).then(() => user.delete());
}
