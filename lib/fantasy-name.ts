import { randomInt } from "node:crypto";

/**
 * Nama akun tamu: dua kata bertema fantasy, dipilih acak, tanpa pemain
 * mengetik apa pun. Dipisah dari lib/accounts.ts supaya daftar katanya
 * tidak mengotori file logic akun.
 */

const NOUNS = [
  "Dragon", "Wizard", "Knight", "Fairy", "Wolf", "Falcon", "Phoenix",
  "Giant", "Wanderer", "Hunter", "Druid", "Paladin", "Noble",
  "Oracle", "Blacksmith", "Rider", "Warrior", "Ranger",
  "Bard", "Alchemist", "Prince", "Queen", "Archer", "Guardian",
  "Soldier", "Captain", "Fox", "Bear",
];

const ADJECTIVES = [
  "Brave", "Mysterious", "Legendary", "Mighty", "Cunning", "Eternal",
  "Valiant", "Wise", "Fierce", "Swift", "Enchanted", "Graceful", "Vigilant",
  "Sturdy", "Blazing", "Roaming", "Silent", "Merry", "Grand", "Clever",
  "Rebel", "Loyal", "Hopeful", "Conquering", "Relentless",
  "Radiant", "Generous", "Proud",
];

export function randomFantasyDisplayName(): string {
  const noun = NOUNS[randomInt(NOUNS.length)];
  const adjective = ADJECTIVES[randomInt(ADJECTIVES.length)];
  return `${noun} ${adjective}`;
}
