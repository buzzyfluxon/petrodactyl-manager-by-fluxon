// © flux0n. All rights reserved.

const PAID_PLANS = {
  mini:     { label: "Mini",     price: "₹10/mo",  ram: 256,   cpu: 50,  disk: 2048 },
  core:     { label: "Core",     price: "₹25/mo",  ram: 1024,  cpu: 100, disk: 4096 },
  plus:     { label: "Plus",     price: "₹49/mo",  ram: 2048,  cpu: 200, disk: 8192 },
  pro:      { label: "Pro",      price: "₹89/mo",  ram: 4096,  cpu: 300, disk: 15360 },
  ultra:    { label: "Ultra",    price: "₹169/mo", ram: 8192,  cpu: 500, disk: 25600 },
  titan:    { label: "Titan",    price: "₹249/mo", ram: 12288, cpu: 600, disk: 35840 },
  infinity: { label: "Infinity", price: "₹349/mo", ram: 16384, cpu: 800, disk: 51200 },
};

function getPlan(name) {
  return PAID_PLANS[String(name).toLowerCase()] || null;
}

function formatPlanTable() {
  return Object.values(PAID_PLANS).map((p) =>
    `**${p.label}**  \`${p.price}\`  \`${(p.ram / 1024).toFixed(p.ram % 1024 ? 2 : 0)} GB RAM\`  \`${p.cpu}% CPU\`  \`${(p.disk / 1024).toFixed(p.disk % 1024 ? 2 : 0)} GB Disk\`  \`DDoS Included\``
  ).join("\n");
}

module.exports = { PAID_PLANS, getPlan, formatPlanTable };
