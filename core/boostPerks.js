// © flux0n. All rights reserved.

const BOOST_CHANNEL_ID = process.env.BOOST_CHANNEL_ID || "1545778557190414514";

const BOOST_TIERS = [
  { boosts: 2, memory: 2048, cpu: 100, label: "Tier 2 — 2 Boosts" },
  { boosts: 1, memory: 1024, cpu: 75, label: "Tier 1 — 1 Boost" },
];

function getTierForBoostCount(count) {
  return BOOST_TIERS.find((tier) => count >= tier.boosts) || null;
}

module.exports = {
  BOOST_CHANNEL_ID,
  BOOST_TIERS,
  getTierForBoostCount,
};
