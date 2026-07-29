import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getBotPurchasePlan,
  selectFullBuy,
  shouldBotReload,
  updateBotAmmo,
  type BotInventory,
  type TeamEconomy,
} from '../../src/ai/BotEconomy.ts';

function makeTeamEconomy(overrides: Partial<TeamEconomy> = {}): TeamEconomy {
  return {
    shouldFullSave: false,
    isEcoRound: false,
    averageTeamMoney: 4000,
    ...overrides,
  };
}

function makeInventory(overrides: Partial<BotInventory> = {}): BotInventory {
  return {
    weapon: 'ak47',
    credits: 3000,
    ammoMag: 30,
    ammoReserve: 90,
    armor: 100,
    helmet: true,
    isReloading: false,
    reloadTimeRemaining: 0,
    ...overrides,
  };
}

test('getBotPurchasePlan returns knife on full save', () => {
  const economy = makeTeamEconomy({ shouldFullSave: true });
  const plan = getBotPurchasePlan(5000, 'CT', economy, 3);

  assert.equal(plan.weapon, 'knife');
  assert.equal(plan.armor, false);
  assert.equal(plan.helmet, false);
  assert.deepEqual(plan.utility, []);
});

test('getBotPurchasePlan returns pistol on eco round', () => {
  const economy = makeTeamEconomy({ isEcoRound: true });

  const ctPlan = getBotPurchasePlan(1000, 'CT', economy, 2);
  assert.equal(ctPlan.weapon, 'usp');

  const tPlan = getBotPurchasePlan(1000, 'T', economy, 2);
  assert.equal(tPlan.weapon, 'glock');
});

test('getBotPurchasePlan returns rifle on full buy with enough credits', () => {
  const economy = makeTeamEconomy();

  const ctPlan = getBotPurchasePlan(4000, 'CT', economy, 5);
  assert.equal(ctPlan.weapon, 'm4a1');
  assert.equal(ctPlan.armor, true);

  const tPlan = getBotPurchasePlan(4000, 'T', economy, 5);
  assert.equal(tPlan.weapon, 'ak47');
  assert.equal(tPlan.armor, true);
});

test('selectFullBuy returns ak47 for T side with sufficient credits', () => {
  // 3000 is enough for ak47 (2700) but not awp (4750)
  const weapon = selectFullBuy(3000, 'T');
  assert.equal(weapon, 'ak47');
});

test('shouldBotReload returns true when ammo empty and in cover', () => {
  const inv = makeInventory({ ammoMag: 0, ammoReserve: 30 });
  assert.equal(shouldBotReload(inv, true, false), true);
});

test('shouldBotReload returns false when enemy visible and has ammo', () => {
  const inv = makeInventory({ ammoMag: 15, ammoReserve: 60 });
  assert.equal(shouldBotReload(inv, false, true), false);
});

test('updateBotAmmo completes reload after timer expires', () => {
  const inv = makeInventory({
    ammoMag: 5,
    ammoReserve: 90,
    isReloading: true,
    reloadTimeRemaining: 0.5,
  });

  // First tick: 0.3s, still reloading
  const partial = updateBotAmmo(inv, 0.3, 2.0, 30);
  assert.equal(partial.isReloading, true);
  assert.equal(partial.ammoMag, 5, 'Mag should not change mid-reload');

  // Second tick: 0.3s, timer expires (0.5 - 0.3 - 0.3 = -0.1)
  const done = updateBotAmmo(partial, 0.3, 2.0, 30);
  assert.equal(done.isReloading, false);
  assert.equal(done.ammoMag, 30, 'Mag should be full after reload');
  assert.equal(done.ammoReserve, 65, 'Reserve should be reduced by 25');
});
