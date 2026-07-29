import test from 'node:test';
import assert from 'node:assert/strict';
import { createBotModel } from '../../src/rendering/CharacterLoader.ts';

test('createBotModel builds valid Group, hitboxes, and weapon mount for CT and T', () => {
  const ctBot = createBotModel('CT', 'm4a1');
  assert.ok(ctBot.group, 'CT bot group created');
  assert.ok(ctBot.body, 'CT bot body capsule hitbox created');
  assert.ok(ctBot.head, 'CT bot head group created');
  assert.ok(ctBot.weaponMount, 'CT bot weapon mount created');

  const tBot = createBotModel('T', 'ak47');
  assert.ok(tBot.group, 'T bot group created');
  assert.ok(tBot.body, 'T bot body capsule hitbox created');
  assert.ok(tBot.head, 'T bot head group created');
  assert.ok(tBot.weaponMount, 'T bot weapon mount created');
});
