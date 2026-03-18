'use strict';
const express  = require('express');
const http     = require('http');
const WebSocket= require('ws');
const path     = require('path');
const { v4: uuidv4 } = require('uuid');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════════════════
//  SKIN IMAGE MAP  (fetched once from ByMykel API)
// ═══════════════════════════════════════════════════
let SKIN_IMG = {};   // "AK-47 | Wild Lotus" → Steam CDN URL

async function loadSkinImages() {
  try {
    console.log('⏳ Загружаю текстуры скинов...');
    const res  = await fetch('https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json');
    const list = await res.json();
    list.forEach(s => { if (s.image) SKIN_IMG[s.name] = s.image; });
    console.log(`✅ Загружено ${Object.keys(SKIN_IMG).length} текстур`);
  } catch(e) {
    console.warn('⚠️  Не удалось загрузить текстуры:', e.message, '— буду использовать эмодзи');
  }
}

// ═══════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════
const RARITIES = [
  { name:'Consumer Grade',   color:'#b0c3d9', chance:0.40, basePrice:[4,   25]  },
  { name:'Industrial Grade', color:'#5e98d9', chance:0.25, basePrice:[25,  90]  },
  { name:'Mil-Spec',         color:'#4b69ff', chance:0.15, basePrice:[90,  350] },
  { name:'Restricted',       color:'#8847ff', chance:0.10, basePrice:[350, 1200]},
  { name:'Classified',       color:'#d32ce6', chance:0.05, basePrice:[1200,5000]},
  { name:'Covert',           color:'#eb4b4b', chance:0.03, basePrice:[5000,20000]},
  { name:'★ Special',        color:'#e4ae39', chance:0.02, basePrice:[20000,100000]},
];

const WEARS = [
  { name:'Factory New',    short:'FN', mult:1.45, range:[0.00,0.07] },
  { name:'Minimal Wear',   short:'MW', mult:1.15, range:[0.07,0.15] },
  { name:'Field-Tested',   short:'FT', mult:1.00, range:[0.15,0.38] },
  { name:'Well-Worn',      short:'WW', mult:0.78, range:[0.38,0.45] },
  { name:'Battle-Scarred', short:'BS', mult:0.58, range:[0.45,1.00] },
];

// Emoji fallbacks
const WEAPON_EMOJI = {
  'AK-47':'🔫','M4A4':'🔫','M4A1-S':'🔫','AWP':'🎯','Desert Eagle':'🔫',
  'Glock-18':'🔫','USP-S':'🔫','Five-SeveN':'🔫','P2000':'🔫','P250':'🔫',
  'MP9':'🔫','MP7':'🔫','SG 553':'🔫','CZ75-Auto':'🔫','Tec-9':'🔫',
  'SSG 08':'🎯','Nova':'🔫','MAG-7':'🔫','FAMAS':'🔫','Galil AR':'🔫',
  'P90':'🔫','UMP-45':'🔫','Sawed-Off':'🔫','XM1014':'🔫','MP5-SD':'🔫',
  'MAC-10':'🔫','PP-Bizon':'🔫','Negev':'🔫','M249':'🔫','G3SG1':'🎯',
  'SCAR-20':'🎯','★ Karambit':'🗡️','★ Butterfly Knife':'🗡️','★ M9 Bayonet':'🗡️',
  '★ Bayonet':'🗡️','★ Flip Knife':'🗡️','★ Gut Knife':'🗡️','★ Falchion Knife':'🗡️',
  '★ Shadow Daggers':'🗡️','★ Bowie Knife':'🗡️','★ Huntsman Knife':'🗡️',
  '★ Stiletto Knife':'🗡️','★ Talon Knife':'🗡️','★ Ursus Knife':'🗡️',
};

function emoji(weapon) { return WEAPON_EMOJI[weapon] || '🔫'; }

// ═══════════════════════════════════════════════════
//  CASES
// ═══════════════════════════════════════════════════
const CASES = [
  {
    id:'neon-storm', name:'Neon Storm Case', price:150,
    emoji:'⚡', gradient:'linear-gradient(135deg,#001828,#003050)', accentColor:'#00d4ff',
    items:[
      // Consumer Grade
      { weapon:'AK-47',        skin:'Blue Laminate'       },
      { weapon:'M4A4',         skin:'Urban DDPAT'         },
      { weapon:'AWP',          skin:'Safari Mesh'         },
      { weapon:'Glock-18',     skin:'Wasteland Rebel'     },
      // Industrial Grade
      { weapon:'USP-S',        skin:'Blueprint'           },
      { weapon:'MP9',          skin:'Hypnotic'            },
      { weapon:'P250',         skin:'Asiimov'             },
      { weapon:'SSG 08',       skin:'Blue Spruce'         },
      // Mil-Spec
      { weapon:'M4A4',         skin:'X-Ray'               },
      { weapon:'Desert Eagle', skin:'Conspiracy'          },
      { weapon:'Glock-18',     skin:'Steel Disruption'    },
      { weapon:'AK-47',        skin:'Safari Mesh'         },
      // Restricted
      { weapon:'AK-47',        skin:'Neon Revolution'     },
      { weapon:'M4A1-S',       skin:'Basilisk'            },
      // Classified
      { weapon:'AWP',          skin:'Electric Hive'       },
      { weapon:'Glock-18',     skin:'Gamma Doppler'       },
      // Covert
      { weapon:'AK-47',        skin:'Wild Lotus'          },
      // Special
      { weapon:'★ Karambit',   skin:'Gamma Doppler'       },
    ]
  },
  {
    id:'shadow-ops', name:'Shadow Ops Case', price:250,
    emoji:'🌑', gradient:'linear-gradient(135deg,#150028,#2d0055)', accentColor:'#8847ff',
    items:[
      // Consumer Grade
      { weapon:'Five-SeveN',   skin:'Monkey Business'     },
      { weapon:'P2000',        skin:'Ivory'               },
      { weapon:'Nova',         skin:'Sand Dune'           },
      { weapon:'Tec-9',        skin:'Brass'               },
      // Industrial Grade
      { weapon:'CZ75-Auto',    skin:'Tigris'              },
      { weapon:'MP7',          skin:'Bloodsport'          },
      { weapon:'SG 553',       skin:'Ultraviolet'         },
      { weapon:'MAC-10',       skin:'Neon Rider'          },
      // Mil-Spec
      { weapon:'Glock-18',     skin:'Fade'                },
      { weapon:'M4A4',         skin:'Neo-Noir'            },
      { weapon:'Tec-9',        skin:'Cruelty'             },
      { weapon:'Desert Eagle', skin:'Oxide Blaze'         },
      // Restricted
      { weapon:'M4A1-S',       skin:'Nightmare'           },
      { weapon:'AK-47',        skin:'Phantom Disruptor'   },
      // Classified
      { weapon:'Desert Eagle', skin:'Printstream'         },
      { weapon:'M4A4',         skin:'Poseidon'            },
      // Covert
      { weapon:'AWP',          skin:'Dragon Lore'         },
      // Special
      { weapon:'★ Butterfly Knife', skin:'Doppler'        },
    ]
  },
  {
    id:'dragon-fire', name:'Dragon Fire Case', price:500,
    emoji:'🐉', gradient:'linear-gradient(135deg,#1f0400,#3d0800)', accentColor:'#eb4b4b',
    items:[
      // Consumer Grade
      { weapon:'P90',          skin:'Storm'               },
      { weapon:'FAMAS',        skin:'Colony'              },
      { weapon:'MAG-7',        skin:'Sand Dune'           },
      { weapon:'Sawed-Off',    skin:'Morris'              },
      // Industrial Grade
      { weapon:'P250',         skin:'Cartel'              },
      { weapon:'UMP-45',       skin:'Primal Saber'        },
      { weapon:'Galil AR',     skin:'Rocket Pop'          },
      { weapon:'MP5-SD',       skin:'Phosphor'            },
      // Mil-Spec
      { weapon:'AK-47',        skin:'Point Disarray'      },
      { weapon:'P2000',        skin:'Fire Elemental'      },
      { weapon:'M4A4',         skin:'The Battlestar'      },
      { weapon:'AWP',          skin:'Sun in Leo'          },
      // Restricted
      { weapon:'AWP',          skin:'Wildfire'            },
      { weapon:'AK-47',        skin:'Fuel Injector'       },
      // Classified
      { weapon:'M4A1-S',       skin:'Hot Rod'             },
      { weapon:'Glock-18',     skin:'Dragon Tattoo'       },
      // Covert
      { weapon:'AWP',          skin:'Medusa'              },
      // Special
      { weapon:'★ M9 Bayonet', skin:'Crimson Web'         },
    ]
  },
  {
    id:'arctic-vault', name:'Arctic Vault Case', price:750,
    emoji:'❄️', gradient:'linear-gradient(135deg,#050e18,#0a1e30)', accentColor:'#a8d8f0',
    items:[
      // Consumer Grade
      { weapon:'USP-S',        skin:'Orion'               },
      { weapon:'P250',         skin:'Splash'              },
      { weapon:'AWP',          skin:'Worm God'            },
      { weapon:'M4A4',         skin:'Faded Zebra'         },
      // Industrial Grade
      { weapon:'AK-47',        skin:'Slate'               },
      { weapon:'M4A1-S',       skin:'Bright Water'        },
      { weapon:'PP-Bizon',     skin:'Cobalt Halftone'     },
      { weapon:'P250',         skin:'Contamination'       },
      // Mil-Spec
      { weapon:'M4A4',         skin:'Radiation Hazard'    },
      { weapon:'USP-S',        skin:'Caiman'              },
      { weapon:'Desert Eagle', skin:'Directive'           },
      { weapon:'AK-47',        skin:'Uncharted'           },
      // Restricted
      { weapon:'M4A1-S',       skin:'Printstream'         },
      { weapon:'AWP',          skin:'Containment Breach'  },
      // Classified
      { weapon:'Desert Eagle', skin:'Blaze'               },
      { weapon:'USP-S',        skin:'Cortex'              },
      // Covert
      { weapon:'M4A4',         skin:'Howl'                },
      // Special
      { weapon:'★ Karambit',   skin:'Marble Fade'         },
    ]
  },
];

// ═══════════════════════════════════════════════════
//  RARITY LOOKUP  (by skin name in CASES)
// ═══════════════════════════════════════════════════
const RARITY_THRESHOLDS = ['Consumer Grade','Industrial Grade','Mil-Spec','Restricted','Classified','Covert','★ Special'];

// Assign rarities based on item order in each case
function assignRarity(items) {
  // For each case: items are listed in order Consumer→Special
  // We count items per rarity slot; items already have rarity if we redefine
  return items; // rarities are encoded via position, handled below
}

// Pre-build a rarity map per case
const CASE_ITEM_RARITY = {};
CASES.forEach(c => {
  CASE_ITEM_RARITY[c.id] = {};
  const rarCount  = [4, 4, 4, 2, 2, 1, 1]; // consumer:4, industrial:4, milspec:4, ...
  let idx = 0;
  RARITIES.forEach((rar, ri) => {
    const count = rarCount[ri] || 0;
    for (let k = 0; k < count && idx < c.items.length; k++, idx++) {
      CASE_ITEM_RARITY[c.id][`${c.items[idx].weapon}|${c.items[idx].skin}`] = rar.name;
    }
  });
});

function getItemRarity(caseId, weapon, skin) {
  return CASE_ITEM_RARITY[caseId]?.[`${weapon}|${skin}`] || 'Consumer Grade';
}

// ═══════════════════════════════════════════════════
//  STATE  (swap with Postgres/Redis for production)
// ═══════════════════════════════════════════════════
const users   = new Map();   // userId → user object
const market  = new Map();   // listingId → listing object
const clients = new Map();   // ws → userId
let   IDX     = 100000;
function newId() { return ++IDX; }

// ═══════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════
function rng(min, max)     { return Math.floor(Math.random()*(max-min+1)+min); }
function rnf(min, max, dp) { return parseFloat((Math.random()*(max-min)+min).toFixed(dp||4)); }

function getRarity(name)   { return RARITIES.find(r=>r.name===name) || RARITIES[0]; }

function getWear(f) {
  return WEARS.find(w => f >= w.range[0] && f < w.range[1]) || WEARS[4];
}

function rollRarity(caseItems) {
  // Build pool weighted by chance
  const r = Math.random();
  let cum = 0;
  for (let i = RARITIES.length-1; i >= 0; i--) {
    cum += RARITIES[i].chance;
    if (r < cum) {
      const pool = caseItems.filter(it => it._rarity === RARITIES[i].name);
      if (pool.length) return pool[rng(0, pool.length-1)];
    }
  }
  return caseItems[0];
}

function buildItem(caseId, wpObj, ownerId) {
  const rarName = wpObj._rarity || 'Consumer Grade';
  const rar     = getRarity(rarName);
  const isKnife = rarName === '★ Special';
  const f       = isKnife ? rnf(0.00, 0.15) : rnf(0.00, 0.80);
  const wear    = getWear(f);
  const price   = Math.round(rng(...rar.basePrice) * wear.mult);
  const imgKey  = `${wpObj.weapon} | ${wpObj.skin}`;
  return {
    id:        newId(),
    weapon:    wpObj.weapon,
    skin:      wpObj.skin,
    rarity:    rarName,
    rarColor:  rar.color,
    caseOrigin:CASES.find(c=>c.id===caseId)?.name || '',
    float:     f,
    wear:      wear.name,
    wearShort: wear.short,
    price,
    emoji:     emoji(wpObj.weapon),
    image:     SKIN_IMG[imgKey] || null,
    ownerId,
  };
}

// Add rarity info to case items at startup
function prepareCases() {
  CASES.forEach(c => {
    c.items.forEach(it => {
      it._rarity = getItemRarity(c.id, it.weapon, it.skin);
    });
  });
}

// Give new player 3 starter items (cheap consumer-grade)
function makeStarterItems(uid) {
  const pool = [
    { caseId:'neon-storm',   weapon:'AK-47',      skin:'Blue Laminate'    },
    { caseId:'neon-storm',   weapon:'M4A4',        skin:'Urban DDPAT'      },
    { caseId:'shadow-ops',   weapon:'Five-SeveN',  skin:'Monkey Business'  },
    { caseId:'dragon-fire',  weapon:'P90',         skin:'Storm'            },
    { caseId:'arctic-vault', weapon:'USP-S',       skin:'Orion'            },
    { caseId:'shadow-ops',   weapon:'Tec-9',       skin:'Brass'            },
  ].sort(() => Math.random()-0.5).slice(0, 3);
  return pool.map(p => {
    const wpObj = { weapon: p.weapon, skin: p.skin, _rarity: 'Consumer Grade' };
    return buildItem(p.caseId, wpObj, uid);
  });
}

function userPublic(u) {
  return { id:u.id, name:u.name, balance:u.balance, inventory:u.inventory };
}

function marketList() {
  return Array.from(market.values()).sort((a,b) => b.listedAt - a.listedAt);
}

// ═══════════════════════════════════════════════════
//  BROADCAST
// ═══════════════════════════════════════════════════
function broadcast(data, excludeWs=null) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(ws => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}
function sendTo(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
function broadcastStats() {
  broadcast({ type:'stats', online: wss.clients.size, listings: market.size });
}

// ═══════════════════════════════════════════════════
//  REST  API
// ═══════════════════════════════════════════════════

// Auth / register
app.post('/api/auth', (req, res) => {
  const { userId, name } = req.body || {};
  if (userId && users.has(userId)) {
    const u = users.get(userId);
    if (name && name.trim()) u.name = name.trim().slice(0,20);
    return res.json({ user: userPublic(u), cases: CASES, market: marketList() });
  }
  const id       = uuidv4();
  const uName    = (name && name.trim()) ? name.trim().slice(0,20) : `Player_${id.slice(0,5).toUpperCase()}`;
  const starter  = makeStarterItems(id);
  const user     = { id, name: uName, balance: 1500, inventory: starter };
  users.set(id, user);
  res.json({ user: userPublic(user), cases: CASES, market: marketList(), isNew: true });
});

// Open case → returns the won item, does NOT commit to inventory yet
app.post('/api/open-case', (req, res) => {
  const { userId, caseId } = req.body || {};
  const u = users.get(userId);
  const c = CASES.find(x => x.id === caseId);
  if (!u || !c) return res.status(400).json({ error: 'Неверный запрос' });
  if (u.balance < c.price) return res.status(400).json({ error: 'Недостаточно монет' });
  u.balance -= c.price;
  const wpObj = rollRarity(c.items);
  const item  = buildItem(caseId, wpObj, userId);
  res.json({ item, balance: u.balance });
  broadcast({ type:'activity', msg:`<b>${u.name}</b> открыл <b>${c.name}</b> → ${item.weapon} | ${item.skin} <span style="color:${item.rarColor}">[${item.rarity}]</span>` });
});

// Keep won item
app.post('/api/keep-item', (req, res) => {
  const { userId, item } = req.body || {};
  const u = users.get(userId);
  if (!u || !item) return res.status(400).json({ error: 'Неверный запрос' });
  item.ownerId = userId;
  item.id = newId(); // fresh ID
  u.inventory.push(item);
  res.json({ inventory: u.inventory });
});

// Sell won item immediately (no listing)
app.post('/api/sell-won', (req, res) => {
  const { userId, item } = req.body || {};
  const u = users.get(userId);
  if (!u || !item) return res.status(400).json({ error: 'Неверный запрос' });
  u.balance += item.price;
  res.json({ balance: u.balance });
});

// List item on market
app.post('/api/list', (req, res) => {
  const { userId, itemId, price } = req.body || {};
  const u    = users.get(userId);
  if (!u)    return res.status(400).json({ error: 'Пользователь не найден' });
  const idx  = u.inventory.findIndex(i => i.id === itemId);
  if (idx<0) return res.status(400).json({ error: 'Предмет не найден' });
  const p    = parseInt(price);
  if (!p || p < 1) return res.status(400).json({ error: 'Неверная цена' });
  const item = u.inventory.splice(idx, 1)[0];
  const listing = { id:newId(), item, sellerId:userId, sellerName:u.name, price:p, listedAt:Date.now() };
  market.set(listing.id, listing);
  res.json({ inventory: u.inventory, listing });
  broadcast({ type:'listing_add', listing });
  broadcast({ type:'activity', msg:`<b>${u.name}</b> выставил <b>${item.weapon} | ${item.skin}</b> за <b style="color:#00d4ff">${p.toLocaleString()} ₡</b>` });
  broadcastStats();
});

// Buy listing
app.post('/api/buy', (req, res) => {
  const { userId, listingId } = req.body || {};
  const u = users.get(userId);
  const l = market.get(listingId);
  if (!u || !l) return res.status(400).json({ error: 'Лот не найден' });
  if (l.sellerId === userId) return res.status(400).json({ error: 'Нельзя купить свой лот' });
  if (u.balance < l.price) return res.status(400).json({ error: 'Недостаточно монет' });
  u.balance -= l.price;
  // Pay seller
  const seller = users.get(l.sellerId);
  if (seller) seller.balance += l.price;
  const bought = { ...l.item, id:newId(), ownerId:userId };
  u.inventory.push(bought);
  market.delete(listingId);
  res.json({ balance:u.balance, inventory:u.inventory });
  broadcast({ type:'listing_rm', listingId });
  broadcast({ type:'activity', msg:`<b>${u.name}</b> купил <b>${l.item.weapon} | ${l.item.skin}</b> за <b style="color:#e4ae39">${l.price.toLocaleString()} ₡</b>` });
  // Notify seller
  wss.clients.forEach(ws => {
    if (clients.get(ws) === l.sellerId) {
      sendTo(ws, { type:'sold', item:l.item, price:l.price, buyer:u.name });
    }
  });
  broadcastStats();
});

// Cancel listing
app.post('/api/cancel', (req, res) => {
  const { userId, listingId } = req.body || {};
  const u = users.get(userId);
  const l = market.get(listingId);
  if (!u || !l) return res.status(400).json({ error: 'Лот не найден' });
  if (l.sellerId !== userId) return res.status(400).json({ error: 'Нет прав' });
  market.delete(listingId);
  u.inventory.push(l.item);
  res.json({ inventory: u.inventory });
  broadcast({ type:'listing_rm', listingId });
  broadcastStats();
});

// Stats
app.get('/api/stats', (_req, res) => res.json({ online:wss.clients.size, listings:market.size, players:users.size }));

// ═══════════════════════════════════════════════════
//  WEBSOCKET
// ═══════════════════════════════════════════════════
wss.on('connection', ws => {
  sendTo(ws, { type:'stats', online:wss.clients.size, listings:market.size });
  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'auth') {
        clients.set(ws, msg.userId);
        broadcastStats();
      }
    } catch(_){}
  });
  ws.on('close', () => {
    clients.delete(ws);
    broadcastStats();
  });
});

// ═══════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;

prepareCases();

server.listen(PORT, async () => {
  console.log(`\n🚀 VAULT.MARKET запущен → http://localhost:${PORT}\n`);
  await loadSkinImages();
});
