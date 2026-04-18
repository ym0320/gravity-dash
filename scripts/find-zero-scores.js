// Find and list ranking entries with score == 0 (to clean up old ghost entries)
const firebase = require('firebase/compat/app');
require('firebase/compat/auth');
require('firebase/compat/firestore');

firebase.initializeApp({
  apiKey: 'AIzaSyB2bAikCJG2ZOKKea4UBg70iUawmb4XWQ8',
  authDomain: 'gravity-dash-cdce1.firebaseapp.com',
  projectId: 'gravity-dash-cdce1',
});

(async () => {
  try {
    await firebase.auth().signInAnonymously();
    const db = firebase.firestore();

    console.log('=== Endless rankings with score == 0 ===');
    const r = await db.collection('rankings').where('score', '==', 0).get();
    if (r.empty) console.log('  (none)');
    else r.forEach(d => console.log(`  uid=${d.id} name=${d.data().name}`));

    console.log('\n=== Challenge rankings with kills == 0 ===');
    const c = await db.collection('challengeRankings').where('kills', '==', 0).get();
    if (c.empty) console.log('  (none)');
    else c.forEach(d => console.log(`  uid=${d.id} name=${d.data().name}`));

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
