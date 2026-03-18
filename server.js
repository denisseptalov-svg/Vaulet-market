'use strict';
const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const path      = require('path');
const { v4: uuidv4 } = require('uuid');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════════════════
//  SKIN IMAGE MAP
// ═══════════════════════════════════════════════════
let SKIN_IMG = {};

async function loadSkinImages() {
  try {
    console.log('⏳ Загружаю текстуры скинов...');
    const res  = await fetch('https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json');
    const list = await res.json();
    list.forEach(s => { if (s.image) SKIN_IMG[s.name] = s.image; });
    console.log(`✅ Загружено ${Object.keys(SKIN_IMG).length} текстур`);
  } catch(e) {
    console.warn('⚠️  Текстуры не загружены:', e.message);
  }
}

// ═══════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════
const RARITIES = [
  { name:'Consumer Grade',   color:'#b0c3d9', chance:0.40, basePrice:[4,    25]    },
  { name:'Industrial Grade', color:'#5e98d9', chance:0.25, basePrice:[25,   90]    },
  { name:'Mil-Spec',         color:'#4b69ff', chance:0.15, basePrice:[90,   350]   },
  { name:'Restricted',       color:'#8847ff', chance:0.10, basePrice:[350,  1200]  },
  { name:'Classified',       color:'#d32ce6', chance:0.05, basePrice:[1200, 5000]  },
  { name:'Covert',           color:'#eb4b4b', chance:0.03, basePrice:[5000, 20000] },
  { name:'★ Special',        color:'#e4ae39', chance:0.02, basePrice:[20000,100000]},
];
const RARITY_ORDER = RARITIES.map(r=>r.name);

const WEARS = [
  { name:'Factory New',    short:'FN', mult:1.45, range:[0.00,0.07] },
  { name:'Minimal Wear',   short:'MW', mult:1.15, range:[0.07,0.15] },
  { name:'Field-Tested',   short:'FT', mult:1.00, range:[0.15,0.38] },
  { name:'Well-Worn',      short:'WW', mult:0.78, range:[0.38,0.45] },
  { name:'Battle-Scarred', short:'BS', mult:0.58, range:[0.45,1.00] },
];

// ═══════════════════════════════════════════════════
//  CASES
// ═══════════════════════════════════════════════════
const CASES = [
  {
    id:'neon-storm', name:'Neon Storm Case', price:150,
    emoji:'⚡', gradient:'linear-gradient(135deg,#001828,#003050)', accentColor:'#00d4ff',
    items:[
      { weapon:'AK-47',          skin:'Blue Laminate',       rarity:'Consumer Grade'   },
      { weapon:'M4A4',           skin:'Urban DDPAT',          rarity:'Consumer Grade'   },
      { weapon:'AWP',            skin:'Safari Mesh',          rarity:'Consumer Grade'   },
      { weapon:'Glock-18',       skin:'Wasteland Rebel',      rarity:'Consumer Grade'   },
      { weapon:'USP-S',          skin:'Blueprint',            rarity:'Industrial Grade' },
      { weapon:'MP9',            skin:'Hypnotic',             rarity:'Industrial Grade' },
      { weapon:'P250',           skin:'Asiimov',              rarity:'Industrial Grade' },
      { weapon:'SSG 08',         skin:'Blue Spruce',          rarity:'Industrial Grade' },
      { weapon:'M4A4',           skin:'X-Ray',                rarity:'Mil-Spec'         },
      { weapon:'Desert Eagle',   skin:'Conspiracy',           rarity:'Mil-Spec'         },
      { weapon:'Glock-18',       skin:'Steel Disruption',     rarity:'Mil-Spec'         },
      { weapon:'AK-47',          skin:'Safari Mesh',          rarity:'Mil-Spec'         },
      { weapon:'AK-47',          skin:'Neon Revolution',      rarity:'Restricted'       },
      { weapon:'M4A1-S',         skin:'Basilisk',             rarity:'Restricted'       },
      { weapon:'AWP',            skin:'Electric Hive',        rarity:'Classified'       },
      { weapon:'Glock-18',       skin:'Gamma Doppler',        rarity:'Classified'       },
      { weapon:'AK-47',          skin:'Wild Lotus',           rarity:'Covert'           },
      { weapon:'★ Karambit',     skin:'Gamma Doppler',        rarity:'★ Special'        },
    ]
  },
  {
    id:'shadow-ops', name:'Shadow Ops Case', price:250,
    emoji:'🌑', gradient:'linear-gradient(135deg,#150028,#2d0055)', accentColor:'#8847ff',
    items:[
      { weapon:'Five-SeveN',     skin:'Monkey Business',      rarity:'Consumer Grade'   },
      { weapon:'P2000',          skin:'Ivory',                rarity:'Consumer Grade'   },
      { weapon:'Nova',           skin:'Sand Dune',            rarity:'Consumer Grade'   },
      { weapon:'Tec-9',          skin:'Brass',                rarity:'Consumer Grade'   },
      { weapon:'CZ75-Auto',      skin:'Tigris',               rarity:'Industrial Grade' },
      { weapon:'MP7',            skin:'Bloodsport',           rarity:'Industrial Grade' },
      { weapon:'SG 553',         skin:'Ultraviolet',          rarity:'Industrial Grade' },
      { weapon:'MAC-10',         skin:'Neon Rider',           rarity:'Industrial Grade' },
      { weapon:'Glock-18',       skin:'Fade',                 rarity:'Mil-Spec'         },
      { weapon:'M4A4',           skin:'Neo-Noir',             rarity:'Mil-Spec'         },
      { weapon:'Tec-9',          skin:'Cruelty',              rarity:'Mil-Spec'         },
      { weapon:'Desert Eagle',   skin:'Oxide Blaze',          rarity:'Mil-Spec'         },
      { weapon:'M4A1-S',         skin:'Nightmare',            rarity:'Restricted'       },
      { weapon:'AK-47',          skin:'Phantom Disruptor',    rarity:'Restricted'       },
      { weapon:'Desert Eagle',   skin:'Printstream',          rarity:'Classified'       },
      { weapon:'M4A4',           skin:'Poseidon',             rarity:'Classified'       },
      { weapon:'AWP',            skin:'Dragon Lore',          rarity:'Covert'           },
      { weapon:'★ Butterfly Knife', skin:'Doppler',           rarity:'★ Special'        },
    ]
  },
  {
    id:'dragon-fire', name:'Dragon Fire Case', price:500,
    emoji:'🐉', gradient:'linear-gradient(135deg,#1f0400,#3d0800)', accentColor:'#eb4b4b',
    items:[
      { weapon:'P90',            skin:'Storm',                rarity:'Consumer Grade'   },
      { weapon:'FAMAS',          skin:'Colony',               rarity:'Consumer Grade'   },
      { weapon:'MAG-7',          skin:'Sand Dune',            rarity:'Consumer Grade'   },
      { weapon:'Sawed-Off',      skin:'Morris',               rarity:'Consumer Grade'   },
      { weapon:'P250',           skin:'Cartel',               rarity:'Industrial Grade' },
      { weapon:'UMP-45',         skin:'Primal Saber',         rarity:'Industrial Grade' },
      { weapon:'Galil AR',       skin:'Rocket Pop',           rarity:'Industrial Grade' },
      { weapon:'MP5-SD',         skin:'Phosphor',             rarity:'Industrial Grade' },
      { weapon:'AK-47',          skin:'Point Disarray',       rarity:'Mil-Spec'         },
      { weapon:'P2000',          skin:'Fire Elemental',       rarity:'Mil-Spec'         },
      { weapon:'M4A4',           skin:'The Battlestar',       rarity:'Mil-Spec'         },
      { weapon:'AWP',            skin:'Sun in Leo',           rarity:'Mil-Spec'         },
      { weapon:'AWP',            skin:'Wildfire',             rarity:'Restricted'       },
      { weapon:'AK-47',          skin:'Fuel Injector',        rarity:'Restricted'       },
      { weapon:'M4A1-S',         skin:'Hot Rod',              rarity:'Classified'       },
      { weapon:'Glock-18',       skin:'Dragon Tattoo',        rarity:'Classified'       },
      { weapon:'AWP',            skin:'Medusa',               rarity:'Covert'           },
      { weapon:'★ M9 Bayonet',   skin:'Crimson Web',          rarity:'★ Special'        },
    ]
  },
  {
    id:'arctic-vault', name:'Arctic Vault Case', price:750,
    emoji:'❄️', gradient:'linear-gradient(135deg,#050e18,#0a1e30)', accentColor:'#a8d8f0',
    items:[
      { weapon:'USP-S',          skin:'Orion',                rarity:'Consumer Grade'   },
      { weapon:'P250',           skin:'Splash',               rarity:'Consumer Grade'   },
      { weapon:'AWP',            skin:'Worm God',             rarity:'Consumer Grade'   },
      { weapon:'M4A4',           skin:'Faded Zebra',          rarity:'Consumer Grade'   },
      { weapon:'AK-47',          skin:'Slate',                rarity:'Industrial Grade' },
      { weapon:'M4A1-S',         skin:'Bright Water',         rarity:'Industrial Grade' },
      { weapon:'PP-Bizon',       skin:'Cobalt Halftone',      rarity:'Industrial Grade' },
      { weapon:'P250',           skin:'Contamination',        rarity:'Industrial Grade' },
      { weapon:'M4A4',           skin:'Radiation Hazard',     rarity:'Mil-Spec'         },
      { weapon:'USP-S',          skin:'Caiman',               rarity:'Mil-Spec'         },
      { weapon:'Desert Eagle',   skin:'Directive',            rarity:'Mil-Spec'         },
      { weapon:'AK-47',          skin:'Uncharted',            rarity:'Mil-Spec'         },
      { weapon:'M4A1-S',         skin:'Printstream',          rarity:'Restricted'       },
      { weapon:'AWP',            skin:'Containment Breach',   rarity:'Restricted'       },
      { weapon:'Desert Eagle',   skin:'Blaze',                rarity:'Classified'       },
      { weapon:'USP-S',          skin:'Cortex',               rarity:'Classified'       },
      { weapon:'M4A4',           skin:'Howl',                 rarity:'Covert'           },
      { weapon:'★ Karambit',     skin:'Marble Fade',          rarity:'★ Special'        },
    ]
  },
  {
    id:'chroma', name:'Chroma Case', price:300,
    emoji:'🌈', gradient:'linear-gradient(135deg,#0d001a,#1a0035)', accentColor:'#d32ce6',
    items:[
      { weapon:'Galil AR',       skin:'Cerberus',             rarity:'Consumer Grade'   },
      { weapon:'MP7',            skin:'Urban Hazard',         rarity:'Consumer Grade'   },
      { weapon:'Tec-9',          skin:'Army Mesh',            rarity:'Consumer Grade'   },
      { weapon:'Nova',           skin:'Predator',             rarity:'Consumer Grade'   },
      { weapon:'Negev',          skin:'Power Loader',         rarity:'Industrial Grade' },
      { weapon:'SG 553',         skin:'Cyrex',                rarity:'Industrial Grade' },
      { weapon:'MP9',            skin:'Ruby Poison Dart',     rarity:'Industrial Grade' },
      { weapon:'P90',            skin:'Trigon',               rarity:'Industrial Grade' },
      { weapon:'AK-47',          skin:'Cartel',               rarity:'Mil-Spec'         },
      { weapon:'Desert Eagle',   skin:'Crimson Web',          rarity:'Mil-Spec'         },
      { weapon:'Five-SeveN',     skin:'Fowl Play',            rarity:'Mil-Spec'         },
      { weapon:'M4A1-S',         skin:'Masterpiece',          rarity:'Mil-Spec'         },
      { weapon:'AWP',            skin:'Fever Dream',          rarity:'Restricted'       },
      { weapon:'M4A4',           skin:'龍王 (Dragon King)',    rarity:'Restricted'       },
      { weapon:'AK-47',          skin:'Vulcan',               rarity:'Classified'       },
      { weapon:'USP-S',          skin:'Stainless',            rarity:'Classified'       },
      { weapon:'M4A1-S',         skin:'Hyper Beast',          rarity:'Covert'           },
      { weapon:'★ Flip Knife',   skin:'Fade',                 rarity:'★ Special'        },
    ]
  },
  {
    id:'gamma', name:'Gamma Case', price:400,
    emoji:'☢️', gradient:'linear-gradient(135deg,#001800,#003000)', accentColor:'#2ecc71',
    items:[
      { weapon:'P2000',          skin:'Oceanic',              rarity:'Consumer Grade'   },
      { weapon:'Dual Berettas',  skin:'Melondrama',           rarity:'Consumer Grade'   },
      { weapon:'FAMAS',          skin:'Meltdown',             rarity:'Consumer Grade'   },
      { weapon:'XM1014',         skin:'XOXO',                 rarity:'Consumer Grade'   },
      { weapon:'PP-Bizon',       skin:'Judgement of Anubis',  rarity:'Industrial Grade' },
      { weapon:'UMP-45',         skin:'Plastique',            rarity:'Industrial Grade' },
      { weapon:'CZ75-Auto',      skin:'Pole Position',        rarity:'Industrial Grade' },
      { weapon:'MP5-SD',         skin:'Desert Strike',        rarity:'Industrial Grade' },
      { weapon:'Five-SeveN',     skin:'Violent Daimyo',       rarity:'Mil-Spec'         },
      { weapon:'AK-47',          skin:'Emerald Pinstripe',    rarity:'Mil-Spec'         },
      { weapon:'FAMAS',          skin:'Valence',              rarity:'Mil-Spec'         },
      { weapon:'AWP',            skin:'Phobos',               rarity:'Mil-Spec'         },
      { weapon:'M4A1-S',         skin:'Mecha Industries',     rarity:'Restricted'       },
      { weapon:'USP-S',          skin:'Neo-Noir',             rarity:'Restricted'       },
      { weapon:'AK-47',          skin:'Wasteland Rebel',      rarity:'Classified'       },
      { weapon:'Glock-18',       skin:'Wasteland Rebel',      rarity:'Classified'       },
      { weapon:'M4A4',           skin:'Bullet Rain',          rarity:'Covert'           },
      { weapon:'★ Gut Knife',    skin:'Gamma Doppler',        rarity:'★ Special'        },
    ]
  },
  {
    id:'fracture', name:'Fracture Case', price:600,
    emoji:'💥', gradient:'linear-gradient(135deg,#1a0a00,#3a1500)', accentColor:'#ff8c00',
    items:[
      { weapon:'Sawed-Off',      skin:'Kiss♥Love',            rarity:'Consumer Grade'   },
      { weapon:'G3SG1',          skin:'Brown Hairline',       rarity:'Consumer Grade'   },
      { weapon:'MAG-7',          skin:'Monster Call',         rarity:'Consumer Grade'   },
      { weapon:'Tec-9',          skin:'Remote Control',       rarity:'Consumer Grade'   },
      { weapon:'Galil AR',       skin:'Connexion',            rarity:'Industrial Grade' },
      { weapon:'MAC-10',         skin:'Disco Tech',           rarity:'Industrial Grade' },
      { weapon:'SG 553',         skin:"Ol' Rusty",            rarity:'Industrial Grade' },
      { weapon:'MP7',            skin:'Guerrilla',            rarity:'Industrial Grade' },
      { weapon:'Desert Eagle',   skin:'Kumicho Dragon',       rarity:'Mil-Spec'         },
      { weapon:'Glock-18',       skin:'Synth Leaf',           rarity:'Mil-Spec'         },
      { weapon:'Five-SeveN',     skin:'Angry Mob',            rarity:'Mil-Spec'         },
      { weapon:'CZ75-Auto',      skin:'Vendetta',             rarity:'Mil-Spec'         },
      { weapon:'M4A1-S',         skin:'Player Two',           rarity:'Restricted'       },
      { weapon:'AK-47',          skin:'Ice Coaled',           rarity:'Restricted'       },
      { weapon:'AWP',            skin:'Exoskeleton',          rarity:'Classified'       },
      { weapon:'MP9',            skin:'Starlight Protector',  rarity:'Classified'       },
      { weapon:'AK-47',          skin:'Legion of Anubis',     rarity:'Covert'           },
      { weapon:'★ Stiletto Knife', skin:'Tiger Tooth',        rarity:'★ Special'        },
    ]
  },
  {
    id:'prisma', name:'Prisma Case', price:350,
    emoji:'💎', gradient:'linear-gradient(135deg,#001020,#001840)', accentColor:'#4b69ff',
    items:[
      { weapon:'P250',           skin:'Verdigris',            rarity:'Consumer Grade'   },
      { weapon:'Nova',           skin:'Toy Soldier',          rarity:'Consumer Grade'   },
      { weapon:'XM1014',         skin:'Zigzag',               rarity:'Consumer Grade'   },
      { weapon:'Dual Berettas',  skin:'Dueling Dragons',      rarity:'Consumer Grade'   },
      { weapon:'MAC-10',         skin:'Allure',               rarity:'Industrial Grade' },
      { weapon:'PP-Bizon',       skin:'Night Riot',           rarity:'Industrial Grade' },
      { weapon:'Negev',          skin:'Mjölnir',              rarity:'Industrial Grade' },
      { weapon:'MP5-SD',         skin:'Condition Zero',       rarity:'Industrial Grade' },
      { weapon:'Glock-18',       skin:'Winterized',           rarity:'Mil-Spec'         },
      { weapon:'USP-S',          skin:'Flashback',            rarity:'Mil-Spec'         },
      { weapon:'Five-SeveN',     skin:'Hybrid',               rarity:'Mil-Spec'         },
      { weapon:'M4A4',           skin:'Poly Mag',             rarity:'Mil-Spec'         },
      { weapon:'AK-47',          skin:'Asiimov',              rarity:'Restricted'       },
      { weapon:'M4A1-S',         skin:'Oxide Blaze',          rarity:'Restricted'       },
      { weapon:'AWP',            skin:'Atheris',              rarity:'Classified'       },
      { weapon:'Desert Eagle',   skin:'Trigger Discipline',   rarity:'Classified'       },
      { weapon:'M4A1-S',         skin:'Neo-Noir',             rarity:'Covert'           },
      { weapon:'★ Talon Knife',  skin:'Doppler',              rarity:'★ Special'        },
    ]
  },
];

// ═══════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════
function rng(min,max){ return Math.floor(Math.random()*(max-min+1)+min); }
function rnf(min,max){ return parseFloat((Math.random()*(max-min)+min).toFixed(4)); }
function getRarity(n){ return RARITIES.find(r=>r.name===n)||RARITIES[0]; }
function getWear(f)  { return WEARS.find(w=>f>=w.range[0]&&f<w.range[1])||WEARS[4]; }
function getImg(w,s) { return SKIN_IMG[`${w} | ${s}`]||null; }

function rollRarity(pool) {
  const r=Math.random(); let cum=0;
  for(let i=RARITIES.length-1;i>=0;i--){
    cum+=RARITIES[i].chance;
    if(r<cum){ const av=pool.filter(it=>it.rarity===RARITIES[i].name); if(av.length) return av[rng(0,av.length-1)]; }
  }
  return pool[rng(0,pool.length-1)];
}

function buildItem(caseId,wpObj,ownerId){
  const rar=getRarity(wpObj.rarity);
  const f=wpObj.rarity==='★ Special'?rnf(0,0.15):rnf(0,0.80);
  const wear=getWear(f);
  const price=Math.round(rng(...rar.basePrice)*wear.mult);
  return { id:rng(100000,999999), weapon:wpObj.weapon, skin:wpObj.skin,
    rarity:wpObj.rarity, rarColor:rar.color,
    caseOrigin:CASES.find(c=>c.id===caseId)?.name||'',
    float:f, wear:wear.name, wearShort:wear.short, price,
    image:getImg(wpObj.weapon,wpObj.skin), ownerId };
}

function enrichedCases(){
  return CASES.map(c=>({...c, items:c.items.map(it=>({...it, image:getImg(it.weapon,it.skin), rarColor:getRarity(it.rarity).color}))}));
}

function makeStarterItems(uid){
  const picks=[
    {caseId:'neon-storm',  weapon:'AK-47',      skin:'Blue Laminate',   rarity:'Consumer Grade'},
    {caseId:'shadow-ops',  weapon:'Five-SeveN',  skin:'Monkey Business', rarity:'Consumer Grade'},
    {caseId:'chroma',      weapon:'Galil AR',    skin:'Cerberus',        rarity:'Consumer Grade'},
  ];
  return picks.map(p=>buildItem(p.caseId,p,uid));
}

// ═══════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════
const users=new Map(), market=new Map(), clients=new Map();
function uPub(u){return {id:u.id,name:u.name,balance:u.balance,inventory:u.inventory,soldCount:u.soldCount||0};}
function mktList(){return Array.from(market.values()).sort((a,b)=>b.listedAt-a.listedAt);}

// ═══════════════════════════════════════════════════
//  BROADCAST
// ═══════════════════════════════════════════════════
function broadcast(data,skip=null){const m=JSON.stringify(data);wss.clients.forEach(ws=>{if(ws!==skip&&ws.readyState===WebSocket.OPEN)ws.send(m);});}
function sendTo(ws,data){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));}
function bStats(){broadcast({type:'stats',online:wss.clients.size,listings:market.size});}

// ═══════════════════════════════════════════════════
//  API
// ═══════════════════════════════════════════════════
app.post('/api/auth',(req,res)=>{
  const{userId,name}=req.body||{};
  if(userId&&users.has(userId)){const u=users.get(userId);if(name&&name.trim())u.name=name.trim().slice(0,20);return res.json({user:uPub(u),cases:enrichedCases(),market:mktList()});}
  const id=uuidv4(),uName=(name&&name.trim())?name.trim().slice(0,20):`Player_${id.slice(0,5).toUpperCase()}`;
  const user={id,name:uName,balance:1500,inventory:makeStarterItems(id),soldCount:0};
  users.set(id,user);
  res.json({user:uPub(user),cases:enrichedCases(),market:mktList(),isNew:true});
});

app.post('/api/open-case',(req,res)=>{
  const{userId,caseId}=req.body||{};
  const u=users.get(userId),c=CASES.find(x=>x.id===caseId);
  if(!u||!c)return res.status(400).json({error:'Неверный запрос'});
  if(u.balance<c.price)return res.status(400).json({error:'Недостаточно монет'});
  u.balance-=c.price;
  const item=buildItem(caseId,rollRarity(c.items),userId);
  res.json({item,balance:u.balance});
  broadcast({type:'activity',msg:`<b>${u.name}</b> открыл <b>${c.name}</b> → ${item.weapon} | ${item.skin} <span style="color:${item.rarColor}">[${item.rarity}]</span>`});
});

app.post('/api/keep-item',(req,res)=>{
  const{userId,item}=req.body||{};const u=users.get(userId);
  if(!u||!item)return res.status(400).json({error:'Ошибка'});
  item.ownerId=userId;item.id=rng(100000,999999);u.inventory.push(item);res.json({inventory:u.inventory});
});

app.post('/api/sell-won',(req,res)=>{
  const{userId,item}=req.body||{};const u=users.get(userId);
  if(!u||!item)return res.status(400).json({error:'Ошибка'});
  u.balance+=item.price;u.soldCount=(u.soldCount||0)+1;res.json({balance:u.balance});
});

app.post('/api/list',(req,res)=>{
  const{userId,itemId,price}=req.body||{};const u=users.get(userId);
  if(!u)return res.status(400).json({error:'Не найден'});
  const idx=u.inventory.findIndex(i=>i.id===itemId);
  if(idx<0)return res.status(400).json({error:'Предмет не найден'});
  const p=parseInt(price);if(!p||p<1)return res.status(400).json({error:'Неверная цена'});
  const item=u.inventory.splice(idx,1)[0];
  const listing={id:rng(100000,999999),item,sellerId:userId,sellerName:u.name,price:p,listedAt:Date.now()};
  market.set(listing.id,listing);
  res.json({inventory:u.inventory,listing});
  broadcast({type:'listing_add',listing});
  broadcast({type:'activity',msg:`<b>${u.name}</b> выставил <b>${item.weapon} | ${item.skin}</b> за <b style="color:#00d4ff">${p.toLocaleString()} ₡</b>`});
  bStats();
});

app.post('/api/buy',(req,res)=>{
  const{userId,listingId}=req.body||{};const u=users.get(userId),l=market.get(listingId);
  if(!u||!l)return res.status(400).json({error:'Лот не найден'});
  if(l.sellerId===userId)return res.status(400).json({error:'Нельзя купить свой лот'});
  if(u.balance<l.price)return res.status(400).json({error:'Недостаточно монет'});
  u.balance-=l.price;
  const seller=users.get(l.sellerId);
  if(seller){seller.balance+=l.price;seller.soldCount=(seller.soldCount||0)+1;}
  u.inventory.push({...l.item,id:rng(100000,999999),ownerId:userId});
  market.delete(listingId);
  res.json({balance:u.balance,inventory:u.inventory});
  broadcast({type:'listing_rm',listingId});
  broadcast({type:'activity',msg:`<b>${u.name}</b> купил <b>${l.item.weapon} | ${l.item.skin}</b> за <b style="color:#e4ae39">${l.price.toLocaleString()} ₡</b>`});
  wss.clients.forEach(ws=>{if(clients.get(ws)===l.sellerId)sendTo(ws,{type:'sold',item:l.item,price:l.price,buyer:u.name});});
  bStats();
});

app.post('/api/cancel',(req,res)=>{
  const{userId,listingId}=req.body||{};const u=users.get(userId),l=market.get(listingId);
  if(!u||!l)return res.status(400).json({error:'Не найден'});
  if(l.sellerId!==userId)return res.status(400).json({error:'Нет прав'});
  market.delete(listingId);u.inventory.push(l.item);res.json({inventory:u.inventory});
  broadcast({type:'listing_rm',listingId});bStats();
});

// CRAFT: 3-10 предметов одной редкости → 1 предмет той же редкости с лучшим wear
app.post('/api/craft',(req,res)=>{
  const{userId,itemIds}=req.body||{};const u=users.get(userId);
  if(!u)return res.status(400).json({error:'Не найден'});
  if(!Array.isArray(itemIds)||itemIds.length<3||itemIds.length>10)return res.status(400).json({error:'Нужно 3-10 предметов'});
  const items=itemIds.map(id=>u.inventory.find(i=>i.id===id)).filter(Boolean);
  if(items.length!==itemIds.length)return res.status(400).json({error:'Предметы не найдены'});
  const rar=items[0].rarity;
  if(!items.every(i=>i.rarity===rar))return res.status(400).json({error:'Все предметы должны быть одной редкости'});
  itemIds.forEach(id=>{const idx=u.inventory.findIndex(i=>i.id===id);if(idx>=0)u.inventory.splice(idx,1);});
  const pool=[];CASES.forEach(c=>c.items.filter(it=>it.rarity===rar).forEach(it=>pool.push({...it,caseId:c.id})));
  const wpObj=pool[rng(0,pool.length-1)];
  const rarDef=getRarity(rar);
  const bonus=Math.min(itemIds.length*0.05,0.30);
  const f=Math.max(0,rnf(0,0.50)-bonus);
  const wear=getWear(f);
  const result={id:rng(100000,999999),weapon:wpObj.weapon,skin:wpObj.skin,rarity:rar,rarColor:rarDef.color,
    caseOrigin:'🔨 Крафт',float:f,wear:wear.name,wearShort:wear.short,
    price:Math.round(rng(...rarDef.basePrice)*wear.mult),image:getImg(wpObj.weapon,wpObj.skin),ownerId:userId};
  u.inventory.push(result);res.json({result,inventory:u.inventory});
  broadcast({type:'activity',msg:`<b>${u.name}</b> скрафтил <b>${result.weapon} | ${result.skin}</b> <span style="color:${result.rarColor}">[${result.rarity}]</span>`});
});

// CONTRACT: ровно 10 предметов одной редкости → 1 предмет следующей редкости
app.post('/api/contract',(req,res)=>{
  const{userId,itemIds}=req.body||{};const u=users.get(userId);
  if(!u)return res.status(400).json({error:'Не найден'});
  if(!Array.isArray(itemIds)||itemIds.length!==10)return res.status(400).json({error:'Нужно ровно 10 предметов'});
  const items=itemIds.map(id=>u.inventory.find(i=>i.id===id)).filter(Boolean);
  if(items.length!==10)return res.status(400).json({error:'Предметы не найдены'});
  const rar=items[0].rarity;
  if(!items.every(i=>i.rarity===rar))return res.status(400).json({error:'Все 10 предметов должны быть одной редкости'});
  const rarIdx=RARITY_ORDER.indexOf(rar);
  if(rarIdx>=RARITY_ORDER.length-1)return res.status(400).json({error:'Нельзя улучшить ★ Special'});
  const nextRar=RARITY_ORDER[rarIdx+1];
  const pool=[];CASES.forEach(c=>c.items.filter(it=>it.rarity===nextRar).forEach(it=>pool.push({...it,caseId:c.id})));
  if(!pool.length)return res.status(400).json({error:'Нет предметов следующей редкости'});
  itemIds.forEach(id=>{const idx=u.inventory.findIndex(i=>i.id===id);if(idx>=0)u.inventory.splice(idx,1);});
  const wpObj=pool[rng(0,pool.length-1)];
  const nextDef=getRarity(nextRar);
  const f=rnf(0,0.70);const wear=getWear(f);
  const result={id:rng(100000,999999),weapon:wpObj.weapon,skin:wpObj.skin,rarity:nextRar,rarColor:nextDef.color,
    caseOrigin:'📋 Контракт',float:f,wear:wear.name,wearShort:wear.short,
    price:Math.round(rng(...nextDef.basePrice)*wear.mult),image:getImg(wpObj.weapon,wpObj.skin),ownerId:userId};
  u.inventory.push(result);res.json({result,inventory:u.inventory});
  broadcast({type:'activity',msg:`🎉 <b>${u.name}</b> выполнил контракт → <b>${result.weapon} | ${result.skin}</b> <span style="color:${result.rarColor}">[${result.rarity}]</span>`});
});

app.get('/api/stats',(_,res)=>res.json({online:wss.clients.size,listings:market.size,players:users.size}));

// ═══════════════════════════════════════════════════
//  WEBSOCKET
// ═══════════════════════════════════════════════════
wss.on('connection',ws=>{
  sendTo(ws,{type:'stats',online:wss.clients.size,listings:market.size});
  ws.on('message',raw=>{ try{const m=JSON.parse(raw);if(m.type==='auth'){clients.set(ws,m.userId);bStats();}}catch(_){} });
  ws.on('close',()=>{ clients.delete(ws);bStats(); });
});

const PORT=process.env.PORT||3000;
server.listen(PORT,async()=>{ console.log(`\n🚀 VAULT.MARKET → http://localhost:${PORT}\n`); await loadSkinImages(); });
