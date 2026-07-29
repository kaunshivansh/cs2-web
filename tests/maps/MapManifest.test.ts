import test from 'node:test';
import assert from 'node:assert/strict';

import { MAP_MANIFEST, validateMapManifest } from '../../src/maps/MapManifest.ts';

test('MAP_MANIFEST declares backed competitive tactical map with valid metadata', () => {
  const result = validateMapManifest(MAP_MANIFEST);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    MAP_MANIFEST.maps.map((map) => map.id),
    ['city']
  );
});

test('map asset references stay inside public assets for Vercel-safe static serving', () => {
  for (const map of MAP_MANIFEST.maps) {
    assert.ok(map.assetRoot.startsWith('/assets/'));
    assert.ok(map.metadataPath.startsWith('/assets/maps/'));
    assert.equal(map.bombSites.length, 2);
    assert.ok(map.callouts.length >= 6);
  }
});
