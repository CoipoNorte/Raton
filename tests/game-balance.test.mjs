import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, Script } from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const compiled = new Map();

// Run the real engine with a seeded RNG; only browser/audio I/O is stubbed.
function createGame(seed = 1, width = 390, height = 844) {
  let randomState = seed >>> 0;
  const math = Object.create(Math);
  math.random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  const noop = () => {};
  const context = createContext({
    Math: math,
    window: {
      innerWidth: width,
      innerHeight: height,
      devicePixelRatio: 1,
      addEventListener: noop,
      removeEventListener: noop,
    },
    document: { hidden: false, addEventListener: noop, removeEventListener: noop },
    navigator: { vibrate: noop },
    performance: { now: () => 0 },
    cancelAnimationFrame: noop,
  });
  const modules = new Map();
  function load(path) {
    if (modules.has(path)) return modules.get(path).exports;
    if (!compiled.has(path)) {
      compiled.set(path, ts.transpileModule(readFileSync(path, "utf8"), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
      }).outputText);
    }
    const module = { exports: {} };
    modules.set(path, module);
    const execute = new Script(`(function(exports, require, module) {${compiled.get(path)}\n})`, {
      filename: path,
    }).runInContext(context);
    execute(module.exports, (name) => load(resolve(dirname(path), `${name}.ts`)), module);
    return module.exports;
  }
  const { RatonGame } = load(resolve(root, "src/game/engine.ts"));
  const events = { gameOver: 0, hud: null };
  const game = new RatonGame({
    parentElement: { getBoundingClientRect: () => ({ width, height }) },
    style: {},
    getContext: () => ({ setTransform: noop }),
  }, {
    sound: new Proxy({}, { get: () => noop }),
    onHud: (hud) => { events.hud = hud; },
    onGameOver: () => { events.gameOver++; },
  });
  game.vibrateEnabled = false;
  return { game, events, random: (value) => { math.random = () => value; } };
}

function freezeSpawning(game) {
  game.ents = [];
  game.nextRowAt = Infinity;
  game.nextPowerupAt = Infinity;
  game.nextDecorAt = Infinity;
  game.nextToriiAt = Infinity;
}

test("speed starts gently, increases gradually and caps at 880 px/s", () => {
  const { game, events } = createGame();
  freezeSpawning(game);
  let previous = 0;
  for (const seconds of [0, 15, 30, 55, 80, 110, 180, 600]) {
    game.elapsed = seconds;
    game.update(0);
    const expected = 260 + 620 * Math.min(1, seconds / 110) ** 2;
    assert.ok(Math.abs(game.speed - expected) < 1e-8);
    assert.ok(game.speed >= previous && game.speed <= 880);
    assert.ok(events.hud.speed01 >= 0 && events.hud.speed01 <= 1);
    previous = game.speed;
  }
  game.destroy();
});

test("curitas have a real-time cooldown and never spawn at nine lives", () => {
  const { game, random } = createGame();
  random(0.1);
  const opportunity = (elapsed) => {
    game.elapsed = elapsed;
    game.ents = [];
    game.scroll = game.nextPowerupAt;
    game.spawnRow();
    return game.ents.some((entity) => entity.type === "bandaid");
  };
  assert.equal(opportunity(17.99), false);
  assert.equal(opportunity(18), true);
  assert.equal(opportunity(35.99), false);
  assert.equal(opportunity(36), true);
  game.lives = 9;
  assert.equal(opportunity(100), false);
  assert.ok(game.ents.length > 0, "a skipped power-up must not create an empty pattern");
  game.lives = 8;
  assert.equal(opportunity(120), true);
  game.destroy();
});

test("fewer curitas do not turn into extra strawberries", () => {
  const { game, random } = createGame();
  const counts = { bandaid: 0, strawberry: 0, normal: 0 };
  for (let i = 0; i < 1000; i++) {
    random((i + 0.5) / 1000);
    game.ents = [];
    game.elapsed = 20 + i * 20;
    game.scroll = game.nextPowerupAt;
    game.spawnRow();
    const powerup = game.ents.find((e) => e.type === "bandaid" || e.type === "strawberry");
    counts[powerup?.type ?? "normal"]++;
  }
  assert.deepEqual(counts, { bandaid: 500, strawberry: 300, normal: 200 });
  game.destroy();
});

test("advanced patterns contain more traps while retaining cheese rewards", () => {
  function sample(elapsed) {
    const { game } = createGame(90210);
    freezeSpawning(game);
    game.elapsed = elapsed;
    game.update(0);
    let hazards = 0;
    let doubles = 0;
    for (let i = 0; i < 4000; i++) {
      game.ents = [];
      game.pathLanes = [0, 1, 2];
      game.spawnRow();
      const traps = game.ents.filter((e) => e.type === "trap");
      if (traps.length) hazards++;
      if (traps.length === 2) doubles++;
      assert.ok(game.ents.some((e) => e.type === "cheese"));
      assert.ok(game.pathLanes.length > 0);
    }
    game.destroy();
    return { hazards: hazards / 4000, doubles: doubles / 4000 };
  }
  const start = sample(0);
  const advanced = sample(110);
  assert.ok(start.hazards < 0.45);
  assert.ok(advanced.hazards > 0.7 && advanced.hazards < 0.82);
  assert.ok(advanced.hazards > start.hazards + 0.25);
  assert.ok(advanced.doubles > start.doubles + 0.2);
});

test("staggered traps and inter-pattern gaps keep scaling at the new cap", () => {
  const { game, random } = createGame();
  freezeSpawning(game);
  random(0.999);
  for (const elapsed of [1, 55, 110]) {
    game.elapsed = elapsed;
    game.update(0);
    game.ents = [];
    const row = game.spawnRow();
    const traps = game.ents.filter((e) => e.type === "trap");
    assert.equal(traps.length, 2);
    const gap = Math.abs(traps[0].y - traps[1].y);
    assert.ok(gap >= 330);
    assert.ok((gap - 80) / game.speed >= 0.6 - 1e-8);
    assert.equal(row.h, gap);
  }

  // Force a pattern at full speed and inspect the actual scheduling distance.
  game.ents = [];
  game.graceT = 0;
  game.scroll = 10000;
  game.nextRowAt = game.scroll;
  game.update(0);
  const height = Math.max(...game.ents.map((e) => -70 - e.y));
  assert.ok(game.nextRowAt - game.scroll - height > 620);
  game.destroy();
});

test("one trap still costs only one life; three distinct hits end the run", () => {
  const { game, events } = createGame();
  freezeSpawning(game);
  assert.equal(game.lives, 3);
  assert.equal(game.maxLives, 9);
  for (const remaining of [2, 1, 0]) {
    game.ents = [];
    game.invulnT = 0;
    game.spawnEnt("trap", 1, game.playerY());
    game.update(0);
    assert.equal(game.lives, remaining);
    for (let i = 0; i < 8; i++) game.update(0);
    assert.equal(game.lives, remaining);
    if (remaining > 0) assert.equal(game.invulnT, 1.6);
  }
  assert.equal(game.state, "dying");
  for (let i = 0; i < 90; i++) game.update(1 / 60);
  assert.equal(game.state, "dead");
  assert.equal(events.gameOver, 1);
  game.destroy();
});

test("a hit at maximum speed still registers once at 20 fps", () => {
  const { game } = createGame();
  freezeSpawning(game);
  game.elapsed = 110;
  game.update(0);
  game.spawnEnt("trap", 1, game.playerY() - 60);
  game.update(0.05);
  assert.equal(game.lives, 2);
  game.update(0.05);
  assert.equal(game.lives, 2);
  assert.equal(game.state, "playing");
  game.destroy();
});

function checkLayout(game) {
  const traps = game.ents.filter((e) => e.type === "trap");
  const safetyWindow = Math.max(170, game.speed * 0.6);
  for (const trap of traps) {
    const lanes = new Set(traps.filter((other) =>
      Math.abs(other.y - trap.y) < safetyWindow).map((e) => e.lane));
    assert.ok(lanes.size < 3, "no three-lane trap walls in the reaction window");
  }
  for (let i = 0; i < game.ents.length; i++) {
    for (let j = i + 1; j < game.ents.length; j++) {
      const a = game.ents[i];
      const b = game.ents[j];
      if (a.lane === b.lane) {
        assert.ok(Math.abs(a.y - b.y) >= 89, "entities in one lane must not overlap");
      }
    }
  }

  // Find a route through upcoming trap rows with a 220 ms lane-change budget.
  const rows = [];
  for (const trap of traps.sort((a, b) => b.y - a.y)) {
    let row = rows.at(-1);
    if (!row || Math.abs(row.y - trap.y) > 1) {
      row = { y: trap.y, lanes: new Set() };
      rows.push(row);
    }
    row.lanes.add(trap.lane);
  }
  let reachable = [0, 1, 2];
  let previousY = Infinity;
  for (const row of rows) {
    const changes = Math.min(2, Math.floor((previousY - row.y - 80) / (game.speed * 0.22)));
    reachable = [0, 1, 2].filter((lane) => !row.lanes.has(lane) &&
      reachable.some((prior) => Math.abs(prior - lane) <= changes));
    assert.ok(reachable.length > 0, "a route through all upcoming rows must remain");
    previousY = row.y;
  }
}

test("seeded runs remain passable at 60, 30 and 20 fps", () => {
  for (const [width, height] of [[320, 568], [390, 844], [480, 960]]) {
    for (const fps of [60, 30, 20]) {
      for (let seed = 1; seed <= 4; seed++) {
        const { game } = createGame(seed, width, height);
        game.invulnT = Infinity;
        for (let frame = 0; frame < 135 * fps; frame++) {
          const cursor = game.nextRowAt;
          game.update(1 / fps);
          if (cursor !== game.nextRowAt) checkLayout(game);
          assert.ok(game.parts.length <= 48);
          assert.ok(game.floats.length <= 8);
        }
        assert.equal(game.speed, 880);
        game.destroy();
      }
    }
  }
});

test("drawMouse supports all 4 directions, baby mouse, and back view has no belly or front pink ears", () => {
  const drawCode = ts.transpileModule(readFileSync(resolve(root, "src/game/draw.ts"), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  const fn = new Script(`(function(exports, module) {${drawCode}\n})`).runInContext(createContext({ Math }));
  fn(mod.exports, mod);
  const { drawMouse, drawBabyMouse, PALETTE } = mod.exports;

  function makeCtx() {
    const fills = [];
    const strokes = [];
    let fillStyle = "";
    let strokeStyle = "";
    const noop = () => {};
    return {
      fills,
      strokes,
      set fillStyle(v) { fillStyle = v; },
      get fillStyle() { return fillStyle; },
      set strokeStyle(v) { strokeStyle = v; },
      get strokeStyle() { return strokeStyle; },
      lineWidth: 1,
      lineCap: "butt",
      globalAlpha: 1,
      save: noop,
      restore: noop,
      scale: noop,
      translate: noop,
      rotate: noop,
      clip: noop,
      beginPath: noop,
      closePath: noop,
      moveTo: noop,
      lineTo: noop,
      bezierCurveTo: noop,
      quadraticCurveTo: noop,
      ellipse: noop,
      arc: noop,
      fill() { fills.push(fillStyle); },
      stroke() { strokes.push(strokeStyle); },
      createRadialGradient: () => ({ addColorStop: noop }),
    };
  }

  // Vista trasera ("up"): NO debe pintar el color de la pancita ni rellenos rosados de oreja frontal
  const backCtx = makeCtx();
  drawMouse(backCtx, { t: 500, s: 1, lean: 0, running: true, auraLevel: 0.5, dead: false, dir: "up" });
  assert.equal(backCtx.fills.includes(PALETTE.belly), false, "back view must not paint belly color");
  assert.equal(backCtx.fills.includes(PALETTE.pink), false, "back view must not fill pink ear interior");

  // Vista frontal ("down") y perfiles ("left", "right"): SÍ deben pintar la pancita y detalles faciales
  for (const dir of ["down", "left", "right"]) {
    for (const t of [500, 3300]) { // normal + parpadeo
      const ctx = makeCtx();
      drawMouse(ctx, { t, s: 1, lean: 0.05, running: true, auraLevel: 0.5, dead: false, dir });
      assert.ok(ctx.fills.includes(PALETTE.belly), `${dir} view must show belly`);
      assert.ok(ctx.fills.includes(PALETTE.pink), `${dir} view must show pink ears/paws`);
    }
    const deadCtx = makeCtx();
    drawMouse(deadCtx, { t: 500, s: 1, lean: 0, running: false, auraLevel: 0, dead: true, dir });
    assert.ok(deadCtx.strokes.length > 0);
  }

  // Ratoncito seguidor ("drawBabyMouse") en las 4 direcciones
  for (const dir of ["up", "down", "left", "right"]) {
    const babyCtx = makeCtx();
    drawBabyMouse(babyCtx, { t: 800, s: 1, lean: 0, running: true, dir });
    assert.ok(babyCtx.fills.length > 0);
  }
});