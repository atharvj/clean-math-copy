'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const scriptPath = path.join(__dirname, '..', 'clean-math-copy.user.js');
const source = fs.readFileSync(scriptPath, 'utf8');
const packageJson = require('../package.json');
const packageLock = require('../package-lock.json');

test('ships a valid installable userscript metadata block', () => {
  assert.match(source, /^\/\/ ==UserScript==/);
  assert.match(source, /\/\/ @name\s+Clean Math Copy/);
  assert.match(source, /\/\/ @version\s+2\.6\.3/);
  assert.match(source, /\/\/ @namespace\s+https:\/\/github\.com\/atharvj\/clean-math-copy/);
  assert.match(source, /\/\/ @homepageURL\s+https:\/\/github\.com\/atharvj\/clean-math-copy/);
  assert.match(source, /\/\/ @supportURL\s+https:\/\/github\.com\/atharvj\/clean-math-copy\/issues/);
  assert.match(source, /\/\/ @downloadURL\s+https:\/\/raw\.githubusercontent\.com\/atharvj\/clean-math-copy\/main\/clean-math-copy\.user\.js/);
  assert.match(source, /\/\/ @updateURL\s+https:\/\/raw\.githubusercontent\.com\/atharvj\/clean-math-copy\/main\/clean-math-copy\.user\.js/);
  assert.match(source, /\/\/ @run-at\s+document-start/);
  assert.match(source, /\/\/ @sandbox\s+raw/);
  assert.match(source, /\/\/ @inject-into\s+auto/);
  assert.match(source, /\/\/ @grant\s+GM_addElement/);
  assert.match(source, /\/\/ @grant\s+GM\.addElement/);
  assert.match(source, /\/\/ @grant\s+GM_addValueChangeListener/);
  assert.match(source, /\/\/ @grant\s+GM\.addValueChangeListener/);
  assert.match(source, /\/\/ @grant\s+GM_unregisterMenuCommand/);
  assert.match(source, /\/\/ @grant\s+GM\.unregisterMenuCommand/);
  assert.match(source, /\/\/ @grant\s+GM_getResourceText/);
  assert.match(source, /\/\/ @grant\s+GM_getResourceURL/);
  assert.match(source, /\/\/ @grant\s+GM\.getResourceText/);
  assert.match(source, /\/\/ @grant\s+GM\.getResourceUrl/);
  assert.match(source, /\/\/ @match\s+https:\/\/\*\/\*/);
  assert.match(source, /\/\/ ==\/UserScript==/);
  assert.match(source, /const STORAGE_KEY = 'cleanMathCopy\.settings\.v3'/);
  assert.match(source, /outputMode: 'faithful'/);
});

test('ships as one userscript without a companion extension or privileged PDF fetch', () => {
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'manifest.json')), false);
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'extension')), false);
  assert.doesNotMatch(source, /^\/\/ @connect\s+/m);
  assert.doesNotMatch(source, /\bGM_xmlhttpRequest\b|\bGM\.xmlHttpRequest\b/);
});

test('release metadata and package manifests use one consistent version', () => {
  const versions = Array.from(source.matchAll(/^\/\/ @version\s+(\S+)$/gm), (match) => match[1]);
  assert.deepEqual(versions, ['2.6.3']);
  assert.equal(packageJson.version, versions[0]);
  assert.equal(packageLock.version, versions[0]);
  assert.equal(packageLock.packages[''].version, versions[0]);
  assert.equal(packageJson.devDependencies['pdfjs-dist'], '6.1.200');
  assert.equal(packageLock.packages['node_modules/pdfjs-dist'].version, '6.1.200');
  assert.equal((source.match(/^\/\/ @updateURL\s+/gm) || []).length, 1);
  assert.equal((source.match(/^\/\/ @downloadURL\s+/gm) || []).length, 1);
});

test('the installable userscript has no unpinned executable runtime dependency', () => {
  assert.doesNotMatch(source, /\/\/ @require\s+/);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
  assert.doesNotMatch(source, /\beval\s*\(/);
  assert.doesNotMatch(source, /\.innerHTML\s*=/);

  const resources = Array.from(source.matchAll(
    /^\/\/ @resource\s+(clean_math_copy_pdfjs(?:_worker)?)\s+(\S+)#sha256=([a-f0-9]{64})$/gm
  ));
  assert.equal(resources.length, 2);
  const files = {
    clean_math_copy_pdfjs: 'node_modules/pdfjs-dist/build/pdf.min.mjs',
    clean_math_copy_pdfjs_worker: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'
  };
  for (const [, name, url, expectedHash] of resources) {
    assert.match(url, /^https:\/\/cdn\.jsdelivr\.net\/npm\/pdfjs-dist@6\.1\.200\/build\//);
    const digest = crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(__dirname, '..', files[name])))
      .digest('hex');
    assert.equal(digest, expectedHash, name + ' vendor hash must match userscript metadata');
  }
});
