import test from 'node:test';
import assert from 'node:assert/strict';

import { AdaptiveQualityController } from '../../src/rendering/AdaptiveQuality.ts';

test('AdaptiveQualityController lowers pixel ratio after sustained slow frames', () => {
  const controller = new AdaptiveQualityController({ initialPixelRatio: 2, minPixelRatio: 0.75, maxPixelRatio: 2 });

  for (let i = 0; i < 90; i += 1) controller.sampleFrame(1 / 42);

  assert.ok(controller.pixelRatio < 2);
  assert.equal(controller.qualityTier, 'low');
});

test('AdaptiveQualityController recovers quality after sustained fast frames', () => {
  const controller = new AdaptiveQualityController({ initialPixelRatio: 1, minPixelRatio: 0.75, maxPixelRatio: 2 });

  for (let i = 0; i < 140; i += 1) controller.sampleFrame(1 / 144);

  assert.ok(controller.pixelRatio > 1);
  assert.equal(controller.qualityTier, 'high');
});
