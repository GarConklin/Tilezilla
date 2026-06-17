'use strict';

/** Split a file of concatenated JSON objects into parsed docs. */
function splitJsonDocs(s) {
  const out = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else {
      if (ch === '"') inStr = true;
      else if (ch === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && start >= 0) {
          out.push(JSON.parse(s.slice(start, i + 1)));
          start = -1;
        }
      }
    }
  }
  return out;
}

module.exports = { splitJsonDocs };
