// One-off script: delete specific users from rankings/users collections
// Usage: node scripts/cleanup-rankings.js
// Requires: gcloud auth application-default login (or GOOGLE_APPLICATION_CREDENTIALS env)

const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'gravity-dash-cdce1',
});

const db = admin.firestore();

// Names to delete from rankings (full cleanup including users/challengeRankings)
const NAMES_TO_DELETE = ['TsuyoshiMAX', 'Tsuyoshi影武者'];

async function deleteByName(name) {
  console.log(`\n=== Searching for "${name}" in rankings ===`);
  const snap = await db.collection('rankings').where('name', '==', name).get();

  if (snap.empty) {
    console.log(`  (no match)`);
    return;
  }

  for (const doc of snap.docs) {
    const uid = doc.id;
    const d = doc.data();
    console.log(`  Found UID=${uid} score=${d.score}`);
    await Promise.all([
      db.collection('rankings').doc(uid).delete().catch(e => console.warn('  rankings del error:', e.message)),
      db.collection('challengeRankings').doc(uid).delete().catch(() => {}),
      db.collection('users').doc(uid).delete().catch(e => console.warn('  users del error:', e.message)),
    ]);
    console.log(`  Deleted ${uid}`);
  }
}

(async () => {
  try {
    for (const name of NAMES_TO_DELETE) {
      await deleteByName(name);
    }
    console.log('\nDone.');
    process.exit(0);
  } catch (e) {
    console.error('Failed:', e);
    process.exit(1);
  }
})();
