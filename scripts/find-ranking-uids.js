// Find UIDs in rankings by name (read-only, uses anonymous auth)
// Usage: node scripts/find-ranking-uids.js
const firebase = require('firebase/compat/app');
require('firebase/compat/auth');
require('firebase/compat/firestore');

firebase.initializeApp({
  apiKey: 'AIzaSyB2bAikCJG2ZOKKea4UBg70iUawmb4XWQ8',
  authDomain: 'gravity-dash-cdce1.firebaseapp.com',
  projectId: 'gravity-dash-cdce1',
});

const NAMES = ['TsuyoshiMAX', 'Tsuyoshi影武者', 'Tsuyoshi'];

(async () => {
  try {
    await firebase.auth().signInAnonymously();
    const db = firebase.firestore();
    for (const name of NAMES) {
      const snap = await db.collection('rankings').where('name', '==', name).get();
      if (snap.empty) {
        console.log(`${name}: (none)`);
      } else {
        snap.forEach(doc => console.log(`${name}: uid=${doc.id} score=${doc.data().score}`));
      }
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
