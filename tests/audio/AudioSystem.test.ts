import test from 'node:test';
import assert from 'node:assert/strict';

import { AudioSystem } from '../../src/audio/AudioSystem.ts';

test('AudioSystem does not create an AudioContext until explicitly unlocked', () => {
  const audio = new AudioSystem();

  assert.equal(audio.isReady(), false);

  audio.dispose();
});

test('AudioSystem provides methods for headshots, kill chimes, inspect SFX, and announcer voices', () => {
  const audio = new AudioSystem();

  assert.equal(typeof audio.playHeadshotDink, 'function');
  assert.equal(typeof audio.playKillChime, 'function');
  assert.equal(typeof audio.playInspectSound, 'function');
  assert.equal(typeof audio.playLowHpHeartbeat, 'function');
  assert.equal(typeof audio.playAnnouncerVoice, 'function');

  audio.dispose();
});
