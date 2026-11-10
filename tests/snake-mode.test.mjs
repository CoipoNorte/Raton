import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, Script } from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const compiled = new Map();

function loadTsModule(entryPath, globals = {}) {
  const modules = new Map();
  const noop = () => {};
  const context = createContext({
    Math: globals.Math ?? Math,
    window: globals.window ?? {
      innerWidth: 390,
      innerHeight: 600,
      devicePixelRatio: 1,
      addEventListener: noop,
      removeEventListener: noop,
    },
    document: globals.document ?? {
      hidden: false,
      addEventListener: noop,
      removeEventListener: noop,
    },
    navigator: globals.navigator ?? { vibrate: noop },
    performance: globals.performance ?? { now: () => 0 },
    cancelAnimationFrame: noop,
    localStorage: globals.localStorage ?? {
      getItem: () => null,
      setItem: noop,
    },
  });

  function load(path) {
    if (modules.has(path)) return modules.get(path).exports;
    if (!compiled.has(path)) {
      compiled.set(
        path,
        ts.transpileModule(readFileSync(path, "utf8"), {
          compilerOptions: {
            target: ts.ScriptTarget.ES2020,
            module: ts.ModuleKind.CommonJS,
          },
        }).outputText
      );
    }
    const module = { exports: {} };
    modules.set(path, module);
    const execute = new Script(
      `(function(exports, require, module) {${compiled.get(path)}\n})`,
      { filename: path }
    ).runInContext(context);
    execute(
      module.exports,
      (name) => load(resolve(dirname(path), `${name}.ts`)),
      module
    );
    return module.exports;
  }

  return load(entryPath);
}

function createSnake(seed = 7, width = 390, height = 560) {
  let randomState = seed >>> 0;
  const math = Object.create(Math);
  math.random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  const noop = () => {};
  const { RatonSnakeGame, SNAKE_GRID } = loadTsModule(
    resolve(root, "src/game/snakeEngine.ts"),
    { Math: math }
  );

  const events = { gameOver: 0, lastResult: null, hud: null };
  const sounds = [];
  const soundProxy = new Proxy(
    {},
    {
      get: (_, prop) => (...args) => {
        sounds.push({ prop, args });
      },
    }
  );

  const game = new RatonSnakeGame(
    {
      parentElement: { getBoundingClientRect: () => ({ width, height }) },
      style: {},
      getContext: () => ({
        setTransform: noop,
        clearRect: noop,
        fillRect: noop,
        strokeRect: noop,
        beginPath: noop,
        closePath: noop,
        moveTo: noop,
        lineTo: noop,
        arcTo: noop,
        arc: noop,
        ellipse: noop,
        bezierCurveTo: noop,
        quadraticCurveTo: noop,
        save: noop,
        restore: noop,
        translate: noop,
        rotate: noop,
        scale: noop,
        clip: noop,
        fill: noop,
        stroke: noop,
        fillText: noop,
        strokeText: noop,
        createLinearGradient: () => ({ addColorStop: noop }),
        createRadialGradient: () => ({ addColorStop: noop }),
      }),
    },
    {
      sound: soundProxy,
      onHud: (h) => {
        events.hud = h;
      },
      onGameOver: (r) => {
        events.gameOver++;
        events.lastResult = r;
      },
    }
  );
  game.vibrateEnabled = false;
  return { game, SNAKE_GRID, events, sounds };
}

test("snake mode initializes square board with head, cheese, safe traps, 0 followers and 0 shields", () => {
  const { game, SNAKE_GRID, events } = createSnake(1, 390, 620);
  assert.equal(SNAKE_GRID, 11);
  assert.equal(game.followers.length, 0);
  assert.equal(game.shields, 0);
  assert.equal(game.traps.length, 2);
  assert.equal(events.hud.followers, 0);
  assert.equal(events.hud.shields, 0);
  // El escenario cuadrado cabe completamente dentro del contenedor
  assert.ok(game.boardSize > 0 && game.boardSize <= 390 - 24);
  assert.equal(game.boardSize, game.cellSize * SNAKE_GRID);
  game.destroy();
});

test("eating cheese adds one baby mouse to the follower line each time", () => {
  const { game } = createSnake(2);
  game.traps = [];
  for (let i = 1; i <= 5; i++) {
    // Colocamos el queso justo 1 casilla delante
    game.cheese = {
      x: game.head.x + (game.dir === "right" ? 1 : game.dir === "left" ? -1 : 0),
      y: game.head.y + (game.dir === "down" ? 1 : game.dir === "up" ? -1 : 0),
    };
    if (game.cheese.y <= 1) {
      game.turn("right");
      game.stepTick();
      continue;
    }
    game.stepTick();
    assert.equal(game.followers.length, game.cheeseCount);
    assert.equal(game.maxChain, game.followers.length);
  }
  assert.ok(game.cheeseCount >= 4);
  game.destroy();
});

test("colliding with own tail removes half the followers when no shield is active", () => {
  const { game } = createSnake(3);
  game.traps = [];
  game.head = { x: 5, y: 5 };
  game.dir = "up";
  game.invulnT = 0;
  // Formar una cola de 6 ratoncitos con una vuelta delante en (5,4)
  game.followers = [
    { x: 4, y: 5, prevX: 4, prevY: 5, dir: "right" },
    { x: 4, y: 4, prevX: 4, prevY: 4, dir: "down" },
    { x: 5, y: 4, prevX: 5, prevY: 4, dir: "left" }, // justo delante de (5,5)
    { x: 6, y: 4, prevX: 6, prevY: 4, dir: "left" },
    { x: 6, y: 5, prevX: 6, prevY: 5, dir: "up" },
    { x: 6, y: 6, prevX: 6, prevY: 6, dir: "up" },
  ];
  game.cheese = { x: 0, y: 0 };

  game.stepTick(); // avanza a (5,4) chocando con su cola
  assert.equal(game.state, "playing");
  assert.equal(game.followers.length, 3, "6 followers loses half -> 3 remain");
  assert.ok(game.invulnT > 0);
  game.destroy();
});

test("colliding with a trap removes half the followers, and causes Game Over at 0 followers without shields", () => {
  const { game, events } = createSnake(4);
  game.traps = [{ x: 5, y: 4, seed: 1, snapping: false, snapT: 0 }];
  game.head = { x: 5, y: 5 };
  game.dir = "up";
  game.cheese = { x: 0, y: 0 };
  game.followers = [
    { x: 5, y: 6, prevX: 5, prevY: 6, dir: "up" },
    { x: 5, y: 7, prevX: 5, prevY: 7, dir: "up" },
    { x: 5, y: 8, prevX: 5, prevY: 8, dir: "up" },
    { x: 5, y: 9, prevX: 5, prevY: 9, dir: "up" },
    { x: 4, y: 9, prevX: 4, prevY: 9, dir: "right" },
  ];

  game.stepTick(); // 5 seguidores → pierde ceil(5/2) = 3 → quedan 2
  assert.equal(game.state, "playing");
  assert.equal(game.followers.length, 2);

  // Ahora probamos golpe sin seguidores ni escudos → Game Over
  game.invulnT = 0;
  game.followers = [];
  game.shields = 0;
  game.head = { x: 5, y: 5 };
  game.dir = "up";
  game.traps = [{ x: 5, y: 4, seed: 2, snapping: false, snapT: 0 }];
  game.stepTick();
  assert.equal(game.state, "dying");
  for (let i = 0; i < 60; i++) game.update(1 / 60);
  assert.equal(game.state, "dead");
  assert.equal(events.gameOver, 1);
  game.destroy();
});

test("band-aids grant shields up to a max of 3 and block follower loss on collision", () => {
  const { game } = createSnake(5);
  game.traps = [];
  game.head = { x: 5, y: 6 };
  game.dir = "up";
  game.cheese = { x: 0, y: 0 };

  // Recoger 4 curitas seguidas: nunca supera 3
  for (let i = 0; i < 4; i++) {
    game.bandaid = { x: game.head.x, y: game.head.y - 1 };
    game.stepTick();
  }
  assert.equal(game.shields, 3);
  assert.equal(game.shieldsMax, 3);

  // Poner 4 seguidores y chocar con una trampa: gasta 1 escudo y mantiene los 4
  game.followers = [
    { x: 5, y: 3, prevX: 5, prevY: 3, dir: "up" },
    { x: 5, y: 4, prevX: 5, prevY: 4, dir: "up" },
    { x: 5, y: 5, prevX: 5, prevY: 5, dir: "up" },
    { x: 5, y: 6, prevX: 5, prevY: 6, dir: "up" },
  ];
  game.head = { x: 5, y: 2 };
  game.dir = "up";
  game.traps = [{ x: 5, y: 1, seed: 1, snapping: false, snapT: 0 }];
  game.invulnT = 0;
  game.stepTick();

  assert.equal(game.shields, 2);
  assert.equal(game.followers.length, 4, "shield preserves all followers");
  assert.equal(game.state, "playing");
  game.destroy();
});

test("4-direction turns forbid instant 180-degree reversal and save data tracks snakeBest independently", () => {
  const { game } = createSnake(6);
  assert.equal(game.dir, "up");
  game.turn("down"); // 180° bloqueado
  game.stepTick();
  assert.equal(game.dir, "up");
  game.turn("left");
  game.turn("down"); // encolado para el siguiente tick
  game.stepTick();
  assert.equal(game.dir, "left");
  game.stepTick();
  assert.equal(game.dir, "down");
  game.destroy();

  const { EMPTY_SAVE, applyRun, applySnakeRun } = loadTsModule(
    resolve(root, "src/game/db.ts")
  );
  const s1 = applyRun(EMPTY_SAVE, { distance: 1200, cheese: 8, auraMax: 4 });
  assert.equal(s1.next.best, 1200);
  const s2 = applySnakeRun(s1.next, { maxChain: 14, cheese: 14 });
  assert.equal(s2.isRecord, true);
  assert.equal(s2.next.snakeBest, 14);
  assert.equal(s2.next.best, 1200, "runner best must remain intact");
  assert.equal(s2.next.snakeRuns, 1);
  assert.equal(s2.next.snakeCheeseTotal, 14);
});

test("walls are portals: leaving one side enters the opposite side at the same height, never costing mice", () => {
  const { game } = createSnake(8);
  game.cheese = { x: 0, y: 0 };
  game.bandaid = null;
  const move = (head, dir) => {
    game.traps = [];
    game.head = head;
    game.dir = dir;
    game.turnQueue = [];
    game.stepTick();
    return { ...game.head };
  };

  game.followers = [
    { x: 9, y: 5, prevX: 9, prevY: 5, dir: "right" },
    { x: 8, y: 5, prevX: 8, prevY: 5, dir: "right" },
  ];
  assert.deepEqual(move({ x: 10, y: 5 }, "right"), { x: 0, y: 5 });
  assert.equal(game.followers.length, 2, "crossing a wall never costs mice");

  // la fila cruza detrás del líder y cada cría mira hacia donde avanza
  game.traps = [];
  game.stepTick();
  assert.equal(game.followers[0].x, 0);
  assert.equal(game.followers[0].y, 5);
  assert.equal(game.followers[0].dir, "right");
  assert.equal(game.followers[1].x, 10);

  game.followers = [];
  assert.deepEqual(move({ x: 0, y: 3 }, "left"), { x: 10, y: 3 });
  assert.deepEqual(move({ x: 4, y: 0 }, "up"), { x: 4, y: 10 });
  assert.deepEqual(move({ x: 7, y: 10 }, "down"), { x: 7, y: 0 });
  assert.equal(game.state, "playing");
  assert.equal(game.shields, 0);

  // una trampa justo al otro lado del portal sí cuenta
  game.followers = [9, 8, 7, 6].map((x) => ({ x, y: 2, prevX: x, prevY: 2, dir: "right" }));
  game.head = { x: 10, y: 2 };
  game.dir = "right";
  game.turnQueue = [];
  game.invulnT = 0;
  game.traps = [{ x: 0, y: 2, seed: 1, snapping: false, snapT: 0 }];
  game.stepTick();
  assert.equal(game.followers.length, 2, "4 crías → pierde la mitad");
  game.destroy();
});

test("reachability follows portals: a single trap wall no longer encloses the cheese", () => {
  const { game } = createSnake(9);
  game.head = { x: 1, y: 5 };
  game.traps = Array.from({ length: 11 }, (_, y) => ({ x: 3, y, seed: 0, snapping: false, snapT: 0 }));
  assert.equal(game.reachableSet().has(5 * 11 + 6), true, "se llega rodeando por el portal izquierdo");
  game.traps.push(
    ...Array.from({ length: 11 }, (_, y) => ({ x: 8, y, seed: 0, snapping: false, snapT: 0 }))
  );
  assert.equal(game.reachableSet().has(5 * 11 + 6), false, "con dos muros sí queda encerrado");
  game.destroy();
});

function recordingCtx(counter) {
  const store = {};
  return new Proxy(store, {
    get: (target, prop) => {
      if (prop in target) return target[prop];
      if (prop === "createRadialGradient" || prop === "createLinearGradient") {
        return () => ({ addColorStop() {} });
      }
      return (...args) => {
        counter.calls++;
        if (prop === "drawImage") counter.drawImage++;
        return args.length ? undefined : undefined;
      };
    },
    set: (target, prop, value) => {
      target[prop] = value;
      return true;
    },
  });
}

test("sprites: in-place compaction, vector fallback without offscreen canvas, and frame reuse with it", () => {
  const plain = loadTsModule(resolve(root, "src/game/sprites.ts"));
  const arr = [1, 2, 3, 4, 5, 6];
  const same = arr;
  plain.compact(arr, (v) => v % 2 === 0);
  assert.equal(arr, same, "filters in place, no new array");
  assert.deepEqual([...arr], [2, 4, 6]);

  // sin document.createElement: todo se dibuja en vectorial y nunca falla
  const vec = { calls: 0, drawImage: 0 };
  const ctx = recordingCtx(vec);
  const cache = new plain.SpriteCache();
  for (const dir of ["up", "down", "left", "right"]) {
    plain.drawBabyMouseFast(ctx, cache, dir, 1234, 0.6, 2);
  }
  plain.drawTrapFast(ctx, cache, 0.8, 2, 2);
  plain.drawCheeseFast(ctx, cache, 500, 0.86, 2);
  assert.ok(vec.calls > 100, "vector fallback still draws");
  assert.equal(vec.drawImage, 0);
  assert.equal(
    cache.get("x", 10, 10, 1, () => {
      throw new Error("must not retry painting once offscreen canvas is unavailable");
    }),
    null
  );

  // con canvas auxiliar: 8 fotogramas por dirección se pintan una vez y se reutilizan
  const created = [];
  const paint = { calls: 0, drawImage: 0 };
  const fakeDoc = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
    createElement: () => {
      const c = { width: 0, height: 0, getContext: () => recordingCtx(paint) };
      created.push(c);
      return c;
    },
  };
  const mod = loadTsModule(resolve(root, "src/game/sprites.ts"), { document: fakeDoc });
  const cache2 = new mod.SpriteCache();
  const screen = { calls: 0, drawImage: 0 };
  const target = recordingCtx(screen);
  for (let i = 0; i < 120; i++) mod.drawBabyMouseFast(target, cache2, "left", i * 16, 0.6, 2);
  assert.equal(created.length, 8, "un ciclo de carrera = 8 sprites, reutilizados");
  assert.equal(screen.drawImage, 120, "cada frame es una sola copia de píxeles");
  assert.ok(screen.calls < 130, "sin trazado vectorial en pantalla");
});

test("render smoke: both engines draw real frames (portal crossing, pause) and cap resolution at 2x", () => {
  const noop = () => {};
  const fakeDoc = {
    hidden: false,
    addEventListener: noop,
    removeEventListener: noop,
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => recordingCtx({ calls: 0, drawImage: 0 }),
    }),
  };
  const win = {
    innerWidth: 390,
    innerHeight: 700,
    devicePixelRatio: 3,
    addEventListener: noop,
    removeEventListener: noop,
  };
  const sound = new Proxy({}, { get: () => noop });
  const makeCanvas = (counter) => ({
    parentElement: { getBoundingClientRect: () => ({ width: 390, height: 600 }) },
    style: {},
    getContext: () => recordingCtx(counter),
  });

  // Fila de Ratones
  const snakeMod = loadTsModule(resolve(root, "src/game/snakeEngine.ts"), {
    document: fakeDoc,
    window: win,
  });
  const sc = { calls: 0, drawImage: 0 };
  const sCanvas = makeCanvas(sc);
  const g = new snakeMod.RatonSnakeGame(sCanvas, { sound, onHud: noop, onGameOver: noop });
  assert.equal(sCanvas.width, 780, "3x screen renders at 2x internally");
  g.traps = [];
  g.followers = [9, 8].map((x) => ({ x, y: 5, prevX: x, prevY: 5, dir: "right" }));
  g.head = { x: 10, y: 5 };
  g.dir = "right";
  g.stepTick(); // el líder cruza el portal
  for (let i = 0; i < 6; i++) {
    g.tickAccum = i * 0.03;
    g.render(1000 + i * 16);
  }
  assert.ok(sc.drawImage >= 6 * 3, "background + babies are blitted every frame");
  g.setPaused(true);
  g.render(2000);
  g.destroy();

  // 3 Carriles
  const runMod = loadTsModule(resolve(root, "src/game/engine.ts"), {
    document: fakeDoc,
    window: win,
  });
  const rc = { calls: 0, drawImage: 0 };
  const rCanvas = makeCanvas(rc);
  const r = new runMod.RatonGame(rCanvas, { sound, onHud: noop, onGameOver: noop });
  assert.equal(rCanvas.width, 780, "runner also capped at 2x");
  for (let i = 0; i < 90; i++) {
    r.update(1 / 60);
    r.render(i * 16);
  }
  assert.ok(rc.drawImage > 0, "cheese/traps use cached sprites");
  r.destroy();
});
