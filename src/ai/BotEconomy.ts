// BotEconomy.ts — Bot economy compliance

export interface PurchasePlan {
  weapon: string; // weapon ID from WeaponData
  armor: boolean;
  helmet: boolean;
  utility: string[]; // utility IDs
}

export interface TeamEconomy {
  shouldFullSave: boolean;
  isEcoRound: boolean;
  averageTeamMoney: number;
}

export interface BotInventory {
  weapon: string;
  credits: number;
  ammoMag: number;
  ammoReserve: number;
  armor: number;
  helmet: boolean;
  isReloading: boolean;
  reloadTimeRemaining: number;
}

// Weapon prices
const WEAPON_PRICES: Record<string, number> = {
  knife: 0,
  usp: 200,
  glock: 200,
  deagle: 700,
  mp9: 1250,
  mac10: 1050,
  m4a1: 2900,
  ak47: 2700,
  awp: 4750,
};

const ARMOR_PRICE = 650;
const HELMET_PRICE = 350;

// Utility items and prices
const UTILITY_ITEMS: { id: string; price: number }[] = [
  { id: 'smoke', price: 300 },
  { id: 'flash', price: 200 },
  { id: 'he', price: 300 },
  { id: 'molotov', price: 400 },
];

/**
 * Check if a player can afford an item.
 */
export function canAfford(credits: number, itemPrice: number): boolean {
  return credits >= itemPrice;
}

/**
 * Select the best affordable pistol for the team side.
 */
export function selectPistol(credits: number, team: 'CT' | 'T'): string {
  // Try deagle first, then team pistol
  if (canAfford(credits, WEAPON_PRICES.deagle)) {
    return 'deagle';
  }
  // Default team pistol
  return team === 'CT' ? 'usp' : 'glock';
}

/**
 * Select the best affordable primary weapon for full buy.
 */
export function selectFullBuy(credits: number, team: 'CT' | 'T'): string {
  // Try AWP first
  if (canAfford(credits, WEAPON_PRICES.awp)) {
    return 'awp';
  }
  // Team rifle
  if (team === 'CT' && canAfford(credits, WEAPON_PRICES.m4a1)) {
    return 'm4a1';
  }
  if (team === 'T' && canAfford(credits, WEAPON_PRICES.ak47)) {
    return 'ak47';
  }
  // SMGs
  if (team === 'CT' && canAfford(credits, WEAPON_PRICES.mp9)) {
    return 'mp9';
  }
  if (team === 'T' && canAfford(credits, WEAPON_PRICES.mac10)) {
    return 'mac10';
  }
  // Deagle
  if (canAfford(credits, WEAPON_PRICES.deagle)) {
    return 'deagle';
  }
  // Default pistol
  return team === 'CT' ? 'usp' : 'glock';
}

/**
 * Generate a purchase plan for a bot based on credits, team, economy, and round.
 */
export function getBotPurchasePlan(
  credits: number,
  team: 'CT' | 'T',
  teamEconomy: TeamEconomy,
  _round: number
): PurchasePlan {
  // Full save: knife only, no armor
  if (teamEconomy.shouldFullSave) {
    return {
      weapon: 'knife',
      armor: false,
      helmet: false,
      utility: [],
    };
  }

  // Eco round: cheapest pistol, armor only if credits > 650
  if (teamEconomy.isEcoRound) {
    const pistol = team === 'CT' ? 'usp' : 'glock';
    const pistolPrice = WEAPON_PRICES[pistol];
    let remaining = credits - pistolPrice;
    const buyArmor = remaining > ARMOR_PRICE;

    if (buyArmor) {
      remaining -= ARMOR_PRICE;
    }

    return {
      weapon: pistol,
      armor: buyArmor,
      helmet: false,
      utility: [],
    };
  }

  // Full buy
  const weapon = selectFullBuy(credits, team);
  const weaponPrice = WEAPON_PRICES[weapon] ?? 0;
  let remaining = credits - weaponPrice;

  let armor = false;
  let helmet = false;

  if (canAfford(remaining, ARMOR_PRICE)) {
    armor = true;
    remaining -= ARMOR_PRICE;

    if (canAfford(remaining, HELMET_PRICE)) {
      helmet = true;
      remaining -= HELMET_PRICE;
    }
  }

  // Buy utility with remaining credits
  const utility: string[] = [];
  for (const item of UTILITY_ITEMS) {
    if (canAfford(remaining, item.price)) {
      utility.push(item.id);
      remaining -= item.price;
    }
  }

  return { weapon, armor, helmet, utility };
}

/**
 * Update bot ammo state: tick reload timer, refill mag when done.
 */
export function updateBotAmmo(
  inventory: BotInventory,
  dt: number,
  _reloadTime: number,
  magSize: number
): BotInventory {
  const updated = { ...inventory };

  if (updated.isReloading) {
    updated.reloadTimeRemaining -= dt;

    if (updated.reloadTimeRemaining <= 0) {
      updated.isReloading = false;
      updated.reloadTimeRemaining = 0;

      // Refill magazine from reserve
      const ammoNeeded = magSize - updated.ammoMag;
      const ammoToLoad = Math.min(ammoNeeded, updated.ammoReserve);
      updated.ammoMag += ammoToLoad;
      updated.ammoReserve -= ammoToLoad;
    }
  }

  return updated;
}

/**
 * Determine if the bot should reload.
 * Only reload when ammo is low and in cover or no enemy visible.
 */
export function shouldBotReload(
  inventory: BotInventory,
  isInCover: boolean,
  enemyVisible: boolean
): boolean {
  // Don't reload if already reloading
  if (inventory.isReloading) return false;

  // Don't reload if mag is not low (consider low = less than 30% or empty)
  const isAmmoLow = inventory.ammoMag <= 0;

  if (!isAmmoLow) return false;

  // Don't reload if no reserve ammo
  if (inventory.ammoReserve <= 0) return false;

  // Only reload when safe: in cover or enemy not visible
  return isInCover || !enemyVisible;
}
