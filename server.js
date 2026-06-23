const express = require('express');
const http = require('http');
const WebSocket = require('ws');
 
const app = express();
const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

app.use(express.static(__dirname))

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});
app.get('/pub/wuid/:token/start', (req, res) => {
     const host = req.headers.host;
      res.json({
         server_url: `wss://opulent-journey-5v4jv7q55q7c466x-8000.app.github.dev`,
        game_mode: 'ARENA',
        status: 'ok'
    });
});
app.get('/pub/wuid/:token/getUserData', (req, res) => {
    res.json({ success: true, coins: 0, properties: [] });
});
app.get('/pub/wuid/:token/:action', (req, res) => {
    res.json({ success: true });
});
// ----- Server / user list endpoints (SITE_XTHOST/api/*.php) -----
app.get('/api/server.php', (req, res) => {
    const host = req.headers.host;
    res.json({
        success: true,
        servers: [{
            serverUrl: `wss://opulent-journey-5v4jv7q55q7c466x-8000.app.github.dev`,
            name: 'Local Arena',
            region: 'local',
            active: true,
            status: true,
            players: 0
        }]
    });
});

app.get('/api/users.php', (req, res) => {
    res.json({ success: true, Users: [], clientes: [] });
});
 
// =====================================================================
//  Game constants  (must stay consistent with the sgp1 region packet)
// =====================================================================
const MODE = 0;                 // 0 = normal (w.$e)
const MAP_RADIUS = 1500;        // fb.ub
const FOOD_SOFT = 4000;         // fb.cf  (mass softening threshold)
const FOOD_MAX = 15000;          // fb.df
const FOOD_SCALE = MAP_RADIUS * 1.02; // fb.ef()
const TICK_MS = 50;
const TARGET_FOOD = 40000;
const START_MASS = 12;
const MAX_SEGMENTS = 150;
 
// =====================================================================
//  Binary helpers (the client decodes everything BIG-ENDIAN via DataView)
// =====================================================================
function pushU8(a, v) { a.push(v & 0xff); }
function pushI16(a, v) { a.push((v >> 8) & 0xff, v & 0xff); }
function pushI32(a, v) { a.push((v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff); }
function pushF32(a, v) {
    const b = Buffer.alloc(4);
    b.writeFloatBE(v, 0);
    a.push(b[0], b[1], b[2], b[3]);
}
// 3-byte coordinate, inverse of the client's Jg(): [-10000,10000]
function pushPos(a, value) {
    let e = Math.round((value / 10000 + 1) * 8388608);
    if (e < 0) e = 0;
    if (e > 0xffffff) e = 0xffffff;
    a.push((e >> 16) & 0xff, (e >> 8) & 0xff, e & 0xff);
}
// variable length count, inverse of the client's qg()
function pushVarint(a, value) {
    if (value < 128) {
        a.push(value);
    } else if (value < 16384) {
        a.push((value >> 7) | 128, value & 127);
    } else if (value < 2097152) {
        a.push((value >> 14) | 128, ((value >> 7) & 127) | 128, value & 127);
    } else {
        a.push((value >> 21) | 128, ((value >> 14) & 127) | 128, ((value >> 7) & 127) | 128, value & 127);
    }
}

// food id encodes its own position (client reads it back via Pg/Qg)
function encodeFoodId(x, y) {
    const xb = Math.round((x / FOOD_SCALE + 1) * 32768) & 0xffff;
    const yb = Math.round((y / FOOD_SCALE + 1) * 32768) & 0xffff;
    return ((yb << 16) | xb) >>> 0;
}


// segment count grows with mass exactly like the client's Ig()
function segmentCount(mass) {
    let m = mass;
    if (m > FOOD_SOFT) m = Math.atan((m - FOOD_SOFT) / FOOD_MAX) * FOOD_MAX + FOOD_SOFT;
    const a = Math.sqrt(Math.pow(m * 5, 0.707106781186548) * 4 + 25);
    return Math.floor(Math.min(MAX_SEGMENTS, Math.max(3, (a - 5) * 5 + 1)));
}

// =====================================================================
//  World
// =====================================================================
const world = {
    players: new Map(), // id -> worm
    food: new Map(),    // id -> {id,x,y,color,type,value}
    nextId: 1
};
 
function rnd(min, max) { return min + Math.random() * (max - min); }
 
function randomPointInMap(margin = 60) {
    const r = Math.sqrt(Math.random()) * (MAP_RADIUS - margin);
    const a = Math.random() * Math.PI * 2;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}
 
function spawnFood() {
    const p = randomPointInMap();
    const id = encodeFoodId(p.x, p.y);
    if (world.food.has(id)) return;
    world.food.set(id, {
        id,
        x: p.x,
        y: p.y,
        color: Math.floor(rnd(0, 0xffffff)), // packed into 3 Jg bytes as colour
        type: Math.floor(rnd(0, 8)),
        value: 1
    });
}
 
function refillFood() {
    let guard = 0;
    while (world.food.size < TARGET_FOOD && guard++ < 1000) spawnFood();
}
 
function newWorm({ id, name, skin, eyes, mouth, glasses, hat, isBot, ws }) {
    const p = randomPointInMap(300);
    return {
        id, name, skin, eyes, mouth, glasses, hat, isBot, ws,
        x: p.x, y: p.y,
        angle: Math.random() * Math.PI * 2,
        targetAngle: Math.random() * Math.PI * 2,
        boost: false,
        mass: START_MASS,
        alive: true,
        segCount: segmentCount(START_MASS),
        // server side body trail (list of {x,y}, index 0 = head)
        body: [],
        botTurnTimer: 0,
        spawnFrame: true
    };
}
 
function initBody(w) {
    w.body = [];
    for (let i = 0; i < w.segCount; i++) {
        w.body.push({ x: w.x, y: w.y });
    }
}

function bodySpacing(w) {
    // mirrors the feel of the client link distance, kept simple
    return 6 + Math.sqrt(w.mass) * 0.6;
}


function moveWorm(w, dt) {
    if (!w.alive) return;
    const speed = (w.boost ? 10 : 5) * dt;
    // smooth turn toward target angle
    let diff = w.targetAngle - w.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxTurn = 4.5 * dt;
    if (diff > maxTurn) diff = maxTurn;
    if (diff < -maxTurn) diff = -maxTurn;
    w.angle += diff;
     w.x += Math.cos(w.angle) * speed;
    w.y += Math.sin(w.angle) * speed;
 
    // boosting slowly costs mass
    if (w.boost && w.mass > START_MASS) {
        w.mass = Math.max(START_MASS, w.mass - 6 * dt);
    }
 
    // keep inside the arena
    const dist = Math.hypot(w.x, w.y);
    if (dist > MAP_RADIUS - 20) {
        const a = Math.atan2(w.y, w.x);
        w.x = Math.cos(a) * (MAP_RADIUS - 20);
        w.y = Math.sin(a) * (MAP_RADIUS - 20);
        if (w.isBot) w.targetAngle = a + Math.PI + rnd(-0.6, 0.6);
    }
 
    // update body trail (head leads, segments follow at fixed spacing)
    const spacing = bodySpacing(w);
    if (w.body.length === 0) initBody(w);
    w.body[0].x = w.x;
    w.body[0].y = w.y;
    for (let i = 1; i < w.body.length; i++) {
        const prev = w.body[i - 1];
        const cur = w.body[i];
        const dx = prev.x - cur.x;
        const dy = prev.y - cur.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > spacing) {
            const t = (d - spacing) / d;
            cur.x += dx * t;
            cur.y += dy * t;
        }
        }
}

function growWorm(w, amount) {
    w.mass += amount;
    const want = segmentCount(w.mass);
    if (want > w.segCount) {
        const tail = w.body[w.body.length - 1] || { x: w.x, y: w.y };
        while (w.body.length < want) w.body.push({ x: tail.x, y: tail.y });
        w.segCount = want;
    }
}

function botThink(w, dt) {
    w.botTurnTimer -= dt;
    if (w.botTurnTimer <= 0) {
        w.botTurnTimer = rnd(0.6, 2.2);
        // wander, occasionally steer toward nearest food
        let best = null, bestD = 600 * 600;
        for (const f of world.food.values()) {
            const d = (f.x - w.x) ** 2 + (f.y - w.y) ** 2;
            if (d < bestD) { bestD = d; best = f; }
        }
        if (best && Math.random() < 0.7) {
            w.targetAngle = Math.atan2(best.y - w.y, best.x - w.x);
        } else {
            w.targetAngle += rnd(-1.2, 1.2);
        }
        w.boost = Math.random() < 0.05;
    }
}

function eatFood(w) {
    const reach = 22 + Math.sqrt(w.mass) * 1.2;
    const r2 = reach * reach;
    for (const f of world.food.values()) {
        if ((f.x - w.x) ** 2 + (f.y - w.y) ** 2 <= r2) {
            world.food.delete(f.id);
            growWorm(w, f.value);
        }
    }
}

function killWorm(w) {
    if (!w.alive) return;
    w.alive = false;
    // scatter some food where it died
    for (let i = 0; i < Math.min(40, Math.floor(w.mass / 4)); i++) {
        const a = Math.random() * Math.PI * 2;
        const r = rnd(0, 120);
        const x = Math.max(-MAP_RADIUS + 30, Math.min(MAP_RADIUS - 30, w.x + Math.cos(a) * r));
        const y = Math.max(-MAP_RADIUS + 30, Math.min(MAP_RADIUS - 30, w.y + Math.sin(a) * r));
        const id = encodeFoodId(x, y);
        if (!world.food.has(id)) world.food.set(id, { id, x, y, color: Math.floor(rnd(0, 0xffffff)), type: Math.floor(rnd(0, 8)), value: 2 });
    }
}

function checkCollisions() {
    const list = [...world.players.values()].filter(w => w.alive);
    for (const w of list) {
        for (const other of list) {
            if (other === w || !other.alive) continue;
            const headReach = 14 + Math.sqrt(w.mass);
            // hit another worm's body -> die
            for (let i = 2; i < other.body.length; i += 1) {
                const seg = other.body[i];
                const bodyR = 12 + Math.sqrt(other.mass);
                if ((seg.x - w.x) ** 2 + (seg.y - w.y) ** 2 <= (headReach + bodyR) ** 2) {
                    killWorm(w);
                    break;
                }
            }
            if (!w.alive) break;
        }
    }
}

function respawnBots() {
    for (const w of world.players.values()) {
        if (w.isBot && !w.alive) {
            const p = randomPointInMap(300);
            w.x = p.x; w.y = p.y;
            w.angle = Math.random() * Math.PI * 2;
            w.targetAngle = w.angle;
            w.mass = START_MASS;
            w.segCount = segmentCount(START_MASS);
            w.alive = true;
            initBody(w);
            w.spawnFrame = true;
        }
    }
}

// =====================================================================
//  Packet builders
// =====================================================================

// sgp1 / region info
function buildRegionPacket(myId) {
    const a = [];
    pushU8(a, 0);
    pushU8(a, MODE);
    pushI16(a, myId);
    pushF32(a, MAP_RADIUS);
    pushF32(a, FOOD_SOFT);
    pushF32(a, FOOD_MAX);
    return Buffer.from(a);
}

// a single food entry inside the sg section
function pushFoodEntry(a, f) {
    pushI32(a, f.id);
    // colour packed as a Jg coordinate (decorative only)
    a.push((f.color >> 16) & 0xff, (f.color >> 8) & 0xff, f.color & 0xff);
    pushU8(a, f.type);
}

// a single player config inside the vg section
function pushPlayerConfig(a, w) {
    pushI16(a, w.id);
    pushI16(a, w.skin);
    pushI16(a, w.eyes);
    pushI16(a, w.mouth);
    pushI16(a, w.glasses);
    pushI16(a, w.hat);
    const name = (w.name || '').slice(0, 32);
    pushU8(a, name.length);
    for (let i = 0; i < name.length; i++) pushI16(a, name.charCodeAt(i));
}
 
// a single body update inside the xg section
function pushBody(a, w) {
    pushI16(a, w.id);
    pushF32(a, w.mass);
    const count = w.body.length;
    pushVarint(a, count);
    for (let i = 0; i < count; i++) {
        pushPos(a, w.body[i].x);
        pushPos(a, w.body[i].y);
    }
}

// a single head update inside the zg section (other players)
function pushHeadOther(a, w) {
    pushI16(a, w.id);
    pushU8(a, 0x02 | (w.boost ? 1 : 0)); // bit1 = mass present
    pushF32(a, w.mass);
    pushPos(a, w.x);
    pushPos(a, w.y);
    pushVarint(a, 0); // no powerups
}

// the Ag section (own player head)
function pushHeadSelf(a, w) {
    pushU8(a, 0x02 | (w.boost ? 1 : 0)); // bit1 = mass present
    pushF32(a, w.mass);
    pushPos(a, w.x);
    pushPos(a, w.y);
    pushVarint(a, 0); // no powerups
}

// full world packet for a freshly connected client (frame 0)
function buildInitFrame(state) {
    const a = [];
    pushU8(a, 1);
    pushI16(a, 0); // dt ignored on frame 0
 
    // sg: all food
    const food = [...world.food.values()];
    pushVarint(a, food.length);
    for (const f of food) { pushFoodEntry(a, f); state.knownFood.add(f.id); }
 
    pushVarint(a, 0); // tg
    pushVarint(a, 0); // ug
 
    // vg: all player configs
    const alive = [...world.players.values()];
    pushVarint(a, alive.length);
    for (const w of alive) { pushPlayerConfig(a, w); state.knownPlayers.add(w.id); }
 
    pushVarint(a, 0); // wg
 
    // xg: all bodies
    pushVarint(a, alive.length);
    for (const w of alive) pushBody(a, w);
 
    pushVarint(a, 0); // yg
    pushVarint(a, 0); // zg
    // no Ag on frame 0
    return Buffer.from(a);
}
 
// incremental packet (frame >= 1)
function buildUpdateFrame(state, dt) {
    const a = [];
    pushU8(a, 1);
    pushI16(a, dt);
 
    // sg: new food this client hasn't seen
    const newFood = [];
    for (const f of world.food.values()) {
        if (!state.knownFood.has(f.id)) newFood.push(f);
    }
    pushVarint(a, newFood.length);
    for (const f of newFood) { pushFoodEntry(a, f); state.knownFood.add(f.id); }
 
    // tg: food removed since last frame
    const removed = [];
    for (const id of state.knownFood) {
        if (!world.food.has(id)) removed.push(id);
    }
    pushVarint(a, removed.length);
    for (const id of removed) { pushI32(a, id); state.knownFood.delete(id); }
 
    pushVarint(a, 0); // ug
 
    // vg: configs for players this client doesn't know yet
    const newPlayers = [];
    for (const w of world.players.values()) {
        if (!state.knownPlayers.has(w.id)) newPlayers.push(w);
    }
    pushVarint(a, newPlayers.length);
    for (const w of newPlayers) { pushPlayerConfig(a, w); state.knownPlayers.add(w.id); }
 
    pushVarint(a, 0); // wg
 
    // xg: bodies that need a full refresh (newly spawned worms)
    const refreshed = [...world.players.values()].filter(w => w.spawnFrame);
    pushVarint(a, refreshed.length);
    for (const w of refreshed) pushBody(a, w);
 
    pushVarint(a, 0); // yg
 
    // zg: head updates for every other alive worm
    const self = state.worm;
    const others = [...world.players.values()].filter(w => w !== self && w.alive);
    pushVarint(a, others.length);
    for (const w of others) pushHeadOther(a, w);
 
    // Ag: own head (always present from frame 1 onward)
    if (self && self.alive) {
        pushHeadSelf(a, self);
    } else {
        // player is dead: still must emit a valid Ag block
        pushU8(a, 0x02);
        pushF32(a, START_MASS);
        pushPos(a, self ? self.x : 0);
        pushPos(a, self ? self.y : 0);
        pushVarint(a, 0);
    }
    return Buffer.from(a);
}
 
// leaderboard (packet 3)
function buildLeaderboard(selfId) {
    const ranked = [...world.players.values()]
        .filter(w => w.alive)
        .sort((p, q) => q.mass - p.mass);
    const myRank = ranked.findIndex(w => w.id === selfId);
    const top = ranked.slice(0, 10);
    const a = [];
    pushU8(a, 3);
    pushI16(a, ranked.length);            // online count
    pushI16(a, myRank >= 0 ? myRank + 1 : 0); // my rank
    pushU8(a, top.length);
    for (const w of top) {
        pushI16(a, w.id);
        pushF32(a, Math.floor(w.mass * 50));
    }
    return Buffer.from(a);
}
 
// =====================================================================
//  Connection handling
// =====================================================================
function parseHello(buf) {
    // 0x81 hello packet (guest = mode 0, logged user = mode 1)
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const mode = dv.getInt8(3);
    let name = 'Player';
    let skin = 0;
    try {
        if (mode === 0) {
            skin = dv.getInt16(4);
            const len = dv.getInt8(6);
            let s = '';
            for (let i = 0; i < len; i++) s += String.fromCharCode(dv.getInt16(7 + i * 2));
            if (s.trim()) name = s.trim();
        } else {
            const len = dv.getInt16(4);
            let s = '';
            for (let i = 0; i < len; i++) s += String.fromCharCode(dv.getInt16(6 + i * 2));
            // logged-in payload = "<name padded to 16>x<skin4><...>"
            const raw = s.split('x')[0].trim();
            if (raw) name = raw.slice(0, 16);
            const m = s.match(/x(\d{4})/);
            if (m) skin = parseInt(m[1], 10) || 0;
        }
    } catch (e) { /* fall back to defaults */ }
    return { mode, name, skin };
}
wss.on('connection', (ws) => {
    console.log('Yeni oyuncu baglandi');
    const state = {
        worm: null,
        frame: 0,
        knownFood: new Set(),
        knownPlayers: new Set(),
        lastSend: Date.now()
    };
 
    ws.on('message', (raw) => {
        const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
        if (buf.length === 0) return;
 
        // single byte = direction / boost input
        if (buf.length === 1 && state.worm) {
            const b = buf.readUInt8(0);
            const boost = (b & 128) !== 0;
            const q = b & 127;
            state.worm.targetAngle = (q / 128) * Math.PI * 2;
            state.worm.boost = boost && state.worm.mass > START_MASS;
            return;
        }
          // hello packet
        if (buf.readUInt8(0) === 129 && buf.length >= 7) {
            const hello = parseHello(buf);
            const id = world.nextId++;
            const worm = newWorm({
                id,
                name: "Player",
                skin: hello.skin,
                eyes: 0, mouth: 0, glasses: 0, hat: 0,
                isBot: false,
                ws
            });
            initBody(worm);
            world.players.set(id, worm);
            state.worm = worm;
            state.frame = 0;
 
            ws.send(buildRegionPacket(id));
            ws.send(buildInitFrame(state));
            state.frame = 1;
            worm.spawnFrame = false;
            console.log(`Oyuncu girdi: ${hello.name} (id ${id})`);
        }
    });
    ws.on('close', () => {
        if (state.worm) {
            world.players.delete(state.worm.id);
            console.log(`Oyuncu cikti: id ${state.worm.id}`);
        }
    });
    ws.on('error', (e) => console.log('WS error:', e.message));
 
    // per-client send loop
    const loop = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN || !state.worm) return;
        if (state.frame === 0) return; // wait for hello
        try {
            const now = Date.now();
            const dt = Math.max(1, Math.min(50, now - state.lastSend));
            state.lastSend = now;
            ws.send(buildUpdateFrame(state, dt));
            if (state.frame % 5 === 0) ws.send(buildLeaderboard(state.worm.id));
            state.frame++;
            // dead player -> game over screen, then they can replay (new socket)
            if (!state.worm.alive) {
                ws.send(Buffer.from([5]));
                world.players.delete(state.worm.id);
                state.worm = null;
            }
        } catch (e) {
            console.log('send loop error:', e.message);
        }
    }, TICK_MS);
 
    ws.on('close', () => clearInterval(loop));
});

// =====================================================================
//  Bots + global simulation
// =====================================================================
function spawnBots(n) {
    const names = ['Slither', 'Viper', 'Python', 'Cobra', 'Mamba', 'Anaconda', 'Boa', 'Worm', 'Noodle', 'Wiggly', 'Sneaky', 'Coil'];
    for (let i = 0; i < n; i++) {
        const id = world.nextId++;
        const w = newWorm({
            id,
            name: names[i % names.length] + (i + 1),
            skin: Math.floor(rnd(0, 30)),
            eyes: Math.floor(rnd(0, 5)),
            mouth: Math.floor(rnd(0, 5)),
            glasses: 0,
            hat: Math.floor(rnd(0, 5)),
            isBot: true,
            ws: null
        });
        initBody(w);
        world.players.set(id, w);
    }
}
 
let lastTick = Date.now();
function simulate() {
    const now = Date.now();
    const dt = Math.min(0.25, (now - lastTick) / 1000);
    lastTick = now;
 
    for (const w of world.players.values()) {
        if (w.isBot && w.alive) botThink(w, dt);
        moveWorm(w, dt);
        if (w.alive) eatFood(w);
    }
    checkCollisions();
    respawnBots();
    refillFood();
 
    // bodies were force-refreshed for one frame after (re)spawn
    for (const w of world.players.values()) {
        if (w.spawnFrame) {
            // keep flag for one client frame; cleared after init send / below
        }
    }
}
setInterval(simulate, TICK_MS);
 
// clear spawnFrame flags slightly after they are produced so each client
// gets exactly one full body refresh
setInterval(() => {
    for (const w of world.players.values()) w.spawnFrame = false;
}, TICK_MS * 2);
 
refillFood();
spawnBots(10);

server.listen(8000, () => {
    console.log('Sunucu 8000 portunda calisiyor. http://localhost:8000');
});
