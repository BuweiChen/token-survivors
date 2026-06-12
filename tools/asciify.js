// asciify.js -- enforce pure-ASCII source. Em-dashes etc. become ASCII
// punctuation; everything else non-ASCII (emoji in string literals) becomes
// \uXXXX escapes in .js files. Run: node tools/asciify.js [--check]
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILES = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f);
FILES.push('index.html');

const PUNCT = [
  [/\u2014/g, '--'], [/\u2013/g, '-'],
  [/\u2018|\u2019/g, "'"], [/\u201C|\u201D/g, '"'], [/\u2026/g, '...'],
];

const checkOnly = process.argv.includes('--check');
let bad = 0;

for (const rel of FILES) {
  const file = path.join(ROOT, rel);
  let src = fs.readFileSync(file, 'utf8');
  const orig = src;
  for (const [re, rep] of PUNCT) src = src.replace(re, rep);
  if (rel.endsWith('.js')) {
    // escape remaining non-ASCII code units (surrogate-pair safe by unit)
    src = src.replace(/[\u0080-\uffff]/g, c =>
      '\\u' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
  }
  const remaining = src.match(/[^\x00-\x7f]/g);
  if (remaining) {
    console.error(rel + ': ' + remaining.length + ' non-ASCII chars remain (html should use entities):');
    console.error('  ' + [...new Set(remaining)].join(' '));
    bad++;
    continue;
  }
  if (src !== orig) {
    if (checkOnly) { console.error(rel + ': would change'); bad++; }
    else { fs.writeFileSync(file, src); console.log(rel + ': sanitized'); }
  } else {
    console.log(rel + ': already ASCII');
  }
}
process.exit(bad ? 1 : 0);
