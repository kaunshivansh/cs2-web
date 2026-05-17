import test from 'node:test';
import assert from 'node:assert/strict';

import { AudioSystem } from '../../src/audio/AudioSystem.ts';

test('AudioSystem does not create an AudioContext until explicitly unlocked', () => {
  const audio = new AudioSystem();

  assert.equal(audio.isReady(), false);

  audio.dispose();
});
