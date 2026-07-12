#!/usr/bin/env node
'use strict';

/**
 * Catalog 3-letter suffixes: AAA, AAB, …, AAZ, ABA, …, ZZZ (odometer / nested-loop order).
 * NOT Excel column order (which wraps AAZ → AAA and collides after 26 codes).
 */

const MAX_CODES = 26 * 26 * 26;

/**
 * @param {number} index 0-based
 * @returns {string} three uppercase letters
 */
function indexToThreeLetterCode(index) {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_CODES) {
    throw new Error(`3-letter code index out of range: ${index} (max ${MAX_CODES - 1})`);
  }
  const a = Math.floor(index / (26 * 26)) % 26;
  const b = Math.floor(index / 26) % 26;
  const c = index % 26;
  return (
    String.fromCharCode(65 + a) +
    String.fromCharCode(65 + b) +
    String.fromCharCode(65 + c)
  );
}

/**
 * @param {string} code
 * @returns {number}
 */
function threeLetterCodeToIndex(code) {
  const m = String(code || '').match(/^([A-Z])([A-Z])([A-Z])$/);
  if (!m) throw new Error(`Invalid 3-letter code: ${code}`);
  const a = m[1].charCodeAt(0) - 65;
  const b = m[2].charCodeAt(0) - 65;
  const c = m[3].charCodeAt(0) - 65;
  return a * 26 * 26 + b * 26 + c;
}

/**
 * @param {Set<string>} used
 * @returns {string}
 */
function nextThreeLetterCode(used) {
  for (let a = 0; a < 26; a++) {
    for (let b = 0; b < 26; b++) {
      for (let c = 0; c < 26; c++) {
        const code =
          String.fromCharCode(65 + a) + String.fromCharCode(65 + b) + String.fromCharCode(65 + c);
        if (!used.has(code)) return code;
      }
    }
  }
  throw new Error('No free 3-letter code');
}

/**
 * Load suffixes already used in a bucket JSON (data/levels/5x6-0B.json).
 * @param {string} bucketPath
 * @returns {Set<string>}
 */
function loadUsedCodesFromBucketFile(bucketPath) {
  const fs = require('fs');
  const used = new Set();
  if (!fs.existsSync(bucketPath)) return used;
  const doc = JSON.parse(fs.readFileSync(bucketPath, 'utf8'));
  for (const L of doc.levels || []) {
    const m = String(L.id || '').match(/-([A-Z]{3})$/);
    if (m) used.add(m[1]);
  }
  return used;
}

module.exports = {
  MAX_CODES,
  indexToThreeLetterCode,
  threeLetterCodeToIndex,
  nextThreeLetterCode,
  loadUsedCodesFromBucketFile,
};
