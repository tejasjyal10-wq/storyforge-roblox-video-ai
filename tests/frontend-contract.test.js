const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const declared = new Set([...html.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]));
const handlers = new Set([...html.matchAll(/onclick="([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]));
handlers.delete('if');

test('every inline click handler points to a declared function', () => {
  const missing = [...handlers].filter(name => !declared.has(name));
  assert.deepEqual(missing, []);
});

test('AI video generation card is connected to backend generation and status endpoints', () => {
  assert.match(html, /id="providerVideoCard"/);
  assert.match(html, /onclick="generateProviderVideo\(\)"/);
  assert.match(html, /fetch\('\/api\/generate'/);
  assert.match(html, /\/api\/jobs\/\$\{encodeURIComponent/);
  assert.match(html, /function buildProviderPrompt\s*\(/);
  assert.match(html, /function checkProviderHealth\s*\(/);
  assert.match(html, /fetch\('\/api\/health'/);
});

test('HTML contains no duplicate element IDs', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  assert.deepEqual(duplicateIds, []);
});
