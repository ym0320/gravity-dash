const fs = require('fs');
const raw = fs.readFileSync('src/gameHtml.js', 'utf8');

let positions = [];
for (let i = 0; i < raw.length; i++) {
  if (raw[i] === '`') {
    let bs = 0;
    for (let j = i - 1; j >= 0 && raw[j] === '\\'; j--) bs++;
    if (bs % 2 === 0) positions.push(i);
  }
}
console.log('Unescaped backtick count:', positions.length);
console.log('First 5 positions:', positions.slice(0, 5));
if (positions.length > 2) {
  // Show context around 3rd unescaped backtick (first problematic one)
  const p = positions[2];
  console.log('Context around 3rd backtick:', JSON.stringify(raw.substring(p - 40, p + 40)));
}
