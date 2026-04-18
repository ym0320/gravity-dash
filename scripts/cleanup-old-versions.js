// Delete old Firebase Hosting versions to reclaim storage
// Keeps the N most recent versions (including the current FINALIZED one)
// Uses firebase-tools CLI auth
//
// Usage:
//   node scripts/cleanup-old-versions.js [keep_count]
// Default keep_count = 5

// Uses firebase-tools stored refresh token → exchange for access token
const fs = require('fs');
const os = require('os');
const path = require('path');
const fetch = require('node-fetch');

const PROJECT_ID = 'gravity-dash-cdce1';
const SITE = 'gravity-dash-cdce1';
const KEEP = parseInt(process.argv[2] || '5', 10);
const API = 'https://firebasehosting.googleapis.com/v1beta1';

// Firebase CLI OAuth client (public, hardcoded in firebase-tools)
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function getRefreshToken() {
  const p = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  const tok = data && data.tokens && data.tokens.refresh_token;
  if (!tok) throw new Error('No refresh token. Run: firebase login');
  return tok;
}

async function getAccessToken() {
  const refreshToken = getRefreshToken();
  const r = await fetch('https://www.googleapis.com/oauth2/v4/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&refresh_token=${refreshToken}&grant_type=refresh_token`,
  });
  if (!r.ok) throw new Error(`token refresh failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.access_token;
}

async function main() {
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // List versions (paginated)
  let versions = [];
  let pageToken = '';
  do {
    const url = `${API}/sites/${SITE}/versions?pageSize=100${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`list failed: ${r.status} ${await r.text()}`);
    const j = await r.json();
    if (j.versions) versions = versions.concat(j.versions);
    pageToken = j.nextPageToken || '';
  } while (pageToken);

  // Sort newest first
  versions.sort((a, b) => (b.createTime || '').localeCompare(a.createTime || ''));
  console.log(`Total versions: ${versions.length}, keeping ${KEEP}`);

  const toDelete = versions.slice(KEEP).filter(v => v.status !== 'DELETED');
  console.log(`Will delete ${toDelete.length} versions`);

  let deleted = 0;
  for (const v of toDelete) {
    const name = v.name; // "sites/{site}/versions/{id}"
    try {
      const r = await fetch(`${API}/${name}`, { method: 'DELETE', headers });
      if (r.ok) {
        deleted++;
        process.stdout.write(`\rDeleted ${deleted}/${toDelete.length}`);
      } else {
        console.warn(`\nfailed ${name}: ${r.status}`);
      }
    } catch (e) {
      console.warn(`\nerror ${name}: ${e.message}`);
    }
  }
  console.log(`\nDone. Deleted ${deleted} versions.`);
}

main().catch(e => { console.error(e); process.exit(1); });
