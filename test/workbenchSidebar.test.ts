import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('workbench left rail behaves like a compact sticky menu', () => {
  assert.match(appSource, /<aside className="lg:col-span-3 lg:sticky lg:top-24/);
  assert.match(appSource, /lg:max-h-\[calc\(100vh-7rem\)\]/);
  assert.match(appSource, /lg:overflow-y-auto/);
  assert.match(appSource, /只保留入口和导航/);
});

test('workbench left rail hides long helper copy from the visible menu', () => {
  assert.match(appSource, /<p className="sr-only">\{dataset\.description\}<\/p>/);
  assert.match(appSource, /<p className="sr-only">\{section\.description\}<\/p>/);
  assert.match(appSource, /<details className="mt-3 rounded-2xl/);
});
