
import React, { useEffect } from 'react';
import Matter from 'matter-js';
import './style.css';
import { ART } from './assets.js';
import { buildStage, STAGES, START } from './levels.js';
import { buildBackdrop } from './scene.js';
import {
  startAudio,
  engineSound,
  toggleSound,
  toggleMusic,
  playJump,
  playCrateBreak,
  playWin,
  playCrash,
  playLanding,
  playBridgeRattle,
  playClick
} from './audio.js';

const { Engine, Bodies, Body, Composite, Constraint, Events, Query } = Matter;
const NS = 'http://www.w3.org/2000/svg';

export default function App() {
  useEffect(() => {
    const $ = (id) => document.getElementById(id);
    const svg = $('scene');

    if (!svg) return;

    const bd = buildBackdrop(svg);

    const mk = (html, parent = bd.dyn) => {
      const g = document.createElementNS(NS, 'g');
      g.innerHTML = html;
      parent.appendChild(g);
      return g;
    };

    const place = (el, b) => {
      el.setAttribute(
        'transform',
        `translate(${b.position.x.toFixed(1)} ${b.position.y.toFixed(1)}) rotate(${(b.angle * 180 / Math.PI).toFixed(2)})`
      );
    };

    let stage = 1;
    let state = 'play';
    let frame = 0;
    let lvl, engine, chassis, wheels, carEl, wheelEls;

    let terrainBodies = [];
    let planks = [];
    let crates = [];
    let debris = [];
    let puffs = [];

    let nitro = 100;
    let jumpCd = 0;
    let flipTimer = 0;
    let wasGrounded = true;

    let animationId = 0;
    let last = 0;
    let acc = 0;
    let destroyed = false;

    const cam = { x: 0, y: 0 };
    const input = {
      drive: false,
      tilt: false,
      jump: false,
      nitro: false
    };

    const keymap = {
      KeyD: 'drive',
      ArrowRight: 'drive',
      KeyA: 'tilt',
      ArrowLeft: 'tilt',
      KeyW: 'jump',
      ArrowUp: 'jump',
      Space: 'nitro'
    };

    function load(n) {
      stage = ((n - 1 + STAGES) % STAGES) + 1;
      state = 'play';
      frame = 0;
      nitro = 100;
      flipTimer = 0;
      jumpCd = 0;
      wasGrounded = true;
      last = 0;
      acc = 0;

      engine = Engine.create({ gravity: { y: 1.1 } });

      bd.terrain.innerHTML = '';
      bd.dyn.innerHTML = '';

      terrainBodies = [];
      planks = [];
      crates = [];
      debris = [];
      puffs = [];

      lvl = buildStage(stage);

      $('stagelabel').textContent = `STAGE ${stage} / ${STAGES}`;
      $('modal').classList.add('hidden');

      const T = 40;

      for (const p of lvl.polys) {
        for (let i = 0; i < p.length - 1; i++) {
          const [x1, y1] = p[i];
          const [x2, y2] = p[i + 1];

          const len = Math.hypot(x2 - x1, y2 - y1);
          const a = Math.atan2(y2 - y1, x2 - x1);

          const cx = (x1 + x2) / 2 - Math.sin(a) * T / 2;
          const cy = (y1 + y2) / 2 + Math.cos(a) * T / 2;

          terrainBodies.push(
            Bodies.rectangle(cx, cy, len + 4, T, {
              isStatic: true,
              angle: a,
              friction: 1,
              label: 'terrain'
            })
          );
        }

        const top = p.map(([x, y]) => `${x},${y}`).join(' L');
        const lastPoint = p[p.length - 1];
        const firstPoint = p[0];

        const path = document.createElementNS(NS, 'g');

        path.innerHTML = `
          <path d="M${top} L${lastPoint[0]},${lastPoint[1] + 46} L${firstPoint[0]},${firstPoint[1] + 46}Z"
            fill="url(#grass)" stroke-linejoin="round"/>
          <path d="M${top}" fill="none" stroke="#2fb34a" stroke-width="7" stroke-linejoin="round"/>
          <path d="M${top}" transform="translate(0 12)" fill="none" stroke="#e9dc8a" stroke-width="3" stroke-dasharray="14 12"/>
        `;

        bd.terrain.appendChild(path);
      }

      Composite.add(engine.world, terrainBodies);

      for (const br of lvl.bridges) {
        const n = Math.max(1, Math.round((br.x2 - br.x1) / 34));
        const w = (br.x2 - br.x1) / n;
        const row = [];

        for (let i = 0; i < n; i++) {
          const b = Bodies.rectangle(
            br.x1 + w * (i + 0.5),
            br.y1 + 6,
            w - 2,
            12,
            {
              density: 0.0025,
              friction: 1,
              label: 'plank'
            }
          );

          row.push(b);
          planks.push(b);

          b.el = mk(`
            <rect x="${-w / 2}" y="-6" width="${w}" height="12"
              rx="2" fill="#a83a2c" stroke="#6e2118" stroke-width="2"/>
          `);
        }

        const cons = [];

        cons.push(
          Constraint.create({
            pointA: { x: br.x1, y: br.y1 + 6 },
            bodyB: row[0],
            pointB: { x: -w / 2, y: 0 },
            stiffness: 0.95,
            length: 1
          })
        );

        for (let i = 0; i < n - 1; i++) {
          cons.push(
            Constraint.create({
              bodyA: row[i],
              pointA: { x: w / 2, y: 0 },
              bodyB: row[i + 1],
              pointB: { x: -w / 2, y: 0 },
              stiffness: 0.95,
              length: 1
            })
          );
        }

        cons.push(
          Constraint.create({
            bodyA: row[n - 1],
            pointA: { x: w / 2, y: 0 },
            pointB: { x: br.x2, y: br.y2 + 6 },
            stiffness: 0.95,
            length: 1
          })
        );

        Composite.add(engine.world, [...row, ...cons]);
      }

      for (const c of lvl.crates) {
        const b = Bodies.rectangle(c.x, c.y, 30, 30, {
          density: 0.0007,
          friction: 0.6,
          label: 'crate'
        });

        b.el = mk(`<g transform="scale(.94)">${ART.crate}</g>`);
        crates.push(b);
        Composite.add(engine.world, b);
      }

      const hull = Bodies.rectangle(0, 0, 120, 26, {
        chamfer: { radius: 8 }
      });

      const cab = Bodies.rectangle(-8, -22, 56, 22, {
        chamfer: { radius: 8 }
      });

      chassis = Body.create({
        parts: [hull, cab],
        collisionFilter: { group: -1 },
        density: 0.0035,
        friction: 0.3,
        label: 'car'
      });

      Body.setPosition(chassis, {
        x: START.x,
        y: START.y - 62
      });

      wheels = [-42, 42].map((dx) =>
        Bodies.circle(START.x + dx, START.y - 40, 22, {
          collisionFilter: { group: -1 },
          friction: 1,
          density: 0.003,
          label: 'wheel'
        })
      );

      const springs = wheels.map((w, i) =>
        Constraint.create({
          bodyA: chassis,
          pointA: { x: [-42, 42][i], y: 20 },
          bodyB: w,
          stiffness: 0.32,
          damping: 0.14,
          length: 0
        })
      );

      Composite.add(engine.world, [chassis, ...wheels, ...springs]);

      wheelEls = wheels.map(() => mk(`<g>${ART.wheel}</g>`));
      carEl = mk(`<g>${ART.car}</g>`);

      Events.on(engine, 'collisionStart', ({ pairs }) => {
        for (const { bodyA: a, bodyB: b } of pairs) {
          const cr =
            a.label === 'crate' ? a :
            b.label === 'crate' ? b : null;

          const other = cr === a ? b : a;

          if (
            cr &&
            (other.parent === chassis || other.label === 'wheel') &&
            Math.hypot(chassis.velocity.x, chassis.velocity.y) > 2.5
          ) {
            breakCrate(cr);
          }
        }
      });

      cam.x = chassis.position.x - 360;
      cam.y = chassis.position.y - 440;
    }

    function breakCrate(c) {
      if (!c || !crates.includes(c)) return;

      playCrateBreak();
      Composite.remove(engine.world, c);
      c.el.remove();
      crates = crates.filter((x) => x !== c);

      for (let i = 0; i < 4; i++) {
        const d = Bodies.rectangle(
          c.position.x + (i % 2 ? 8 : -8),
          c.position.y + (i < 2 ? -8 : 8),
          11,
          11,
          {
            density: 0.0006,
            label: 'debris',
            collisionFilter: { group: -2 }
          }
        );

        Body.setVelocity(d, {
          x: chassis.velocity.x * 0.8 + (Math.random() - 0.3) * 6,
          y: -3 - Math.random() * 5
        });

        Body.setAngularVelocity(d, (Math.random() - 0.5) * 0.4);

        d.born = frame;
        d.el = mk(`
          <rect x="-5.5" y="-5.5" width="11" height="11"
            fill="#c04a34" stroke="#7a2418" stroke-width="2"/>
        `);

        debris.push(d);
        Composite.add(engine.world, d);
      }
    }

    const touching = (b, list) => Query.collides(b, list).length > 0;

    function step() {
      frame++;

      const grounded = wheels.some(
        (w) => touching(w, terrainBodies) || touching(w, planks)
      );

      const cap = (v, m) => Math.max(-m, Math.min(m, v));

      if (input.drive) {
        wheels.forEach((w) =>
          Body.setAngularVelocity(w, Math.min(w.angularVelocity + 0.025, 0.3))
        );

        if (!grounded) {
          Body.setAngularVelocity(
            chassis,
            cap(chassis.angularVelocity + 0.0012, 0.12)
          );
        }
      }

      if (input.tilt) {
        if (grounded) {
          wheels.forEach((w) =>
            Body.setAngularVelocity(w, Math.max(w.angularVelocity - 0.04, -0.12))
          );
        }

        Body.setAngularVelocity(
          chassis,
          cap(chassis.angularVelocity - 0.0035, 0.12)
        );
      }

      if (jumpCd > 0) jumpCd--;

      if (input.jump && grounded && jumpCd === 0) {
        Body.setVelocity(chassis, {
          x: chassis.velocity.x,
          y: -11
        });

        jumpCd = 40;
        playJump();
      }

      if (!wasGrounded && grounded) {
        const vy = Math.abs(chassis.velocity.y);
        if (vy > 2.2) playLanding(vy);
      }

      wasGrounded = grounded;

      const boosting = input.nitro && nitro > 0;

      if (boosting) {
        const a = chassis.angle;

        Body.applyForce(chassis, chassis.position, {
          x: Math.cos(a) * 0.01,
          y: Math.sin(a) * 0.01
        });

        nitro = Math.max(0, nitro - 0.6);
      } else {
        nitro = Math.min(100, nitro + 0.08);
      }

      Engine.update(engine, 1000 / 60);

      const a =
        ((chassis.angle % (2 * Math.PI)) + 2 * Math.PI) %
        (2 * Math.PI);

      const upsideDown = a > 1.9 && a < 4.38;

      flipTimer =
        upsideDown && touching(chassis, [...terrainBodies, ...planks])
          ? flipTimer + 1
          : 0;

      if (flipTimer > 40) {
        return end(
          'fail',
          'Your hill climber flipped over! Tap anywhere or press ANY key to restart immediately.'
        );
      }

      if (chassis.position.y > lvl.killY) {
        return end(
          'fail',
          'You fell into the canyon! Tap anywhere or press ANY key to restart immediately.'
        );
      }

      if (chassis.position.x > lvl.finishX) {
        return end('win');
      }

      if ((input.drive && grounded && frame % 4 === 0) || boosting) {
        const rear = {
          x: chassis.position.x - Math.cos(chassis.angle) * 66,
          y: chassis.position.y - Math.sin(chassis.angle) * 66 + 6
        };

        const el = mk(`
          <circle r="${boosting ? 5 : 3}"
            fill="${boosting ? '#ff8a2b' : '#7d8ea0'}"/>
        `);

        puffs.push({
          el,
          x: rear.x,
          y: rear.y,
          vx: -chassis.velocity.x * 0.2 - 1,
          vy: -0.4 + Math.random() * 0.6,
          life: 28
        });
      }

      for (const p of puffs) {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        p.el.setAttribute(
          'transform',
          `translate(${p.x} ${p.y}) scale(${p.life / 28})`
        );
      }

      puffs = puffs.filter((p) => {
        if (p.life > 0) return true;
        p.el.remove();
        return false;
      });

      debris = debris.filter((d) => {
        if (frame - d.born < 150) return true;

        Composite.remove(engine.world, d);
        d.el.remove();
        return false;
      });

      const speed =
        Math.hypot(chassis.velocity.x, chassis.velocity.y) * 4.8;

      if (
        grounded &&
        speed > 2.6 &&
        wheels.some((w) => touching(w, planks))
      ) {
        playBridgeRattle();
      }

      engineSound(speed, input.drive, boosting);

      $('dist').textContent =
        `${Math.max(0, Math.round((chassis.position.x - START.x) / 10))} M`;

      $('speed').textContent = `${Math.round(speed)} KM/H`;
      $('nitro').style.width = `${nitro}%`;
    }

    function end(kind, message = '') {
      if (state !== 'play') return;

      state = kind;

      if (kind === 'win') playWin();
      else if (kind === 'fail') playCrash();

      const card = document.querySelector('.card');
      card.classList.toggle('win', kind === 'win');

      $('m-tag').textContent =
        kind === 'win' ? '★ COURSE COMPLETE' : '● ACCIDENT DETECTED!';

      $('m-title').textContent =
        kind === 'win' ? `STAGE ${stage} CLEARED` : `STAGE ${stage} FAILED`;

      $('m-text').textContent =
        kind === 'win'
          ? 'Great driving! Tap anywhere or press ANY key for the next stage.'
          : message;

      $('m-btn').textContent =
        kind === 'win'
          ? '▶ NEXT STAGE (SPACE)'
          : '🔄 RESTART STAGE (R / SPACE)';

      $('modal').classList.remove('hidden');
    }

    function render() {
      if (!chassis || !engine) return;

      const tx =
        chassis.position.x - 360 + chassis.velocity.x * 14;

      const ty = chassis.position.y - 440;

      cam.x += (tx - cam.x) * 0.1;
      cam.y += (ty - cam.y) * 0.08;

      bd.world.setAttribute(
        'transform',
        `translate(${-cam.x.toFixed(1)} ${-cam.y.toFixed(1)})`
      );

      bd.parallax(cam.x, cam.y);

      place(carEl, chassis);

      wheels.forEach((w, i) => place(wheelEls[i], w));

      for (const b of [...planks, ...crates, ...debris]) {
        if (b.el && b.el.isConnected) place(b.el, b);
      }
    }

    function loop(t) {
      if (destroyed) return;

      acc += Math.min(100, t - (last || t));
      last = t;

      while (acc >= 1000 / 60) {
        if (state === 'play') step();
        acc -= 1000 / 60;
      }

      render();
      animationId = requestAnimationFrame(loop);
    }

    function advance() {
      playClick(1.2);

      if (state === 'fail') load(stage);
      else if (state === 'win') load(stage + 1);
      else if (state === 'pause') togglePause();
    }

    function togglePause() {
      playClick(state === 'play' ? 0.85 : 1.25);

      if (state === 'play') {
        state = 'pause';

        $('m-tag').textContent = '❚❚ PAUSED';
        $('m-title').textContent = 'PAUSED';
        $('m-text').textContent = 'Press P or tap anywhere to resume.';
        $('m-btn').textContent = 'RESUME';

        $('modal').classList.remove('hidden');
        document.querySelector('.card').classList.remove('win');
      } else if (state === 'pause') {
        state = 'play';
        $('modal').classList.add('hidden');
      }
    }

    const onKeyDown = (e) => {
      startAudio();

      if (state === 'fail' || state === 'win') {
        e.preventDefault();
        advance();
        return;
      }

      if (e.code === 'KeyR') {
        playClick(0.9);
        load(stage);
        return;
      }

      if (e.code === 'KeyP' || e.code === 'Escape') {
        togglePause();
        return;
      }

      if (keymap[e.code]) {
        input[keymap[e.code]] = true;
        e.preventDefault();
      }
    };

    const onKeyUp = (e) => {
      if (keymap[e.code]) input[keymap[e.code]] = false;
    };

    const onPointerDown = () => startAudio();

    const touchButtons = document.querySelectorAll('.touch button');

    const touchHandlers = [];

    touchButtons.forEach((btn) => {
      const k = btn.dataset.k;

      const down = (e) => {
        e.preventDefault();
        startAudio();
        input[k] = true;
        btn.classList.add('on');
      };

      const up = (e) => {
        e.preventDefault();
        input[k] = false;
        btn.classList.remove('on');
      };

      btn.addEventListener('pointerdown', down);
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((event) => {
        btn.addEventListener(event, up);
      });

      touchHandlers.push({ btn, down, up });
    });

    const modal = $('modal');
    const onModalPointerDown = () => advance();
    const onModalPointerUp = () => {
      if (state === 'pause') togglePause();
    };

    const onPrev = () => {
      playClick(0.9);
      load(stage - 1);
    };

    const onNext = () => {
      playClick(1.1);
      load(stage + 1);
    };

    const onMute = () => {
      startAudio();
      $('mute').textContent = toggleSound() ? '🔊' : '🔇';
    };

    const onMusic = () => {
      startAudio();
      $('music').textContent = toggleMusic() ? '🎵' : '🎶';
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('pointerdown', onPointerDown, { once: true });

    modal.addEventListener('pointerdown', onModalPointerDown);
    modal.addEventListener('pointerup', onModalPointerUp);

    $('prev').addEventListener('click', onPrev);
    $('next').addEventListener('click', onNext);
    $('mute').addEventListener('click', onMute);
    $('pause').addEventListener('click', togglePause);

    if ($('music')) {
      $('music').addEventListener('click', onMusic);
    }

    load(1);
    animationId = requestAnimationFrame(loop);

    return () => {
      destroyed = true;
      cancelAnimationFrame(animationId);

      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('pointerdown', onPointerDown);

      modal.removeEventListener('pointerdown', onModalPointerDown);
      modal.removeEventListener('pointerup', onModalPointerUp);

      $('prev').removeEventListener('click', onPrev);
      $('next').removeEventListener('click', onNext);
      $('mute').removeEventListener('click', onMute);
      $('pause').removeEventListener('click', togglePause);

      if ($('music')) {
        $('music').removeEventListener('click', onMusic);
      }

      touchHandlers.forEach(({ btn, down, up }) => {
        btn.removeEventListener('pointerdown', down);

        ['pointerup', 'pointerleave', 'pointercancel'].forEach((event) => {
          btn.removeEventListener(event, up);
        });
      });

      if (engine) Engine.clear(engine);
      if (bd.terrain) bd.terrain.innerHTML = '';
      if (bd.dyn) bd.dyn.innerHTML = '';
    };
  }, []);

  return (
    <main id="app">
      <svg
        id="scene"
        viewBox="0 0 1280 720"
        preserveAspectRatio="xMidYMid slice"
        aria-label="Hill climbing racing game"
      />

      <div id="stagebar" className="pill">
        <span id="stagelabel">STAGE 1 / 5</span>

        <button id="prev" type="button" aria-label="Previous stage">
          ◀
        </button>

        <button id="next" type="button" aria-label="Next stage">
          ▶
        </button>

        <button id="pause" type="button" aria-label="Pause game">
          ❚❚
        </button>

        <button id="mute" type="button" aria-label="Toggle sound">
          🔊
        </button>

        <button id="music" type="button" aria-label="Toggle music">
          🎵
        </button>
      </div>

      <div id="hud" className="pill">
        <div>
          <small>DISTANCE</small>
          <b id="dist">0 M</b>
        </div>

        <div>
          <small>SPEED</small>
          <b id="speed">0 KM/H</b>
        </div>

        <div className="nitro">
          <small>NITRO</small>
          <i>
            <u id="nitro" />
          </i>
        </div>
      </div>

      <div id="hints" className="pill">
        <kbd>D / →</kbd> DRIVE
        <kbd>A / ←</kbd> TILT
        <kbd>W / ↑</kbd> JUMP
        <kbd className="wide">SPACE</kbd> NITRO
        <kbd>P</kbd> PAUSE
        <kbd>R</kbd> RESTART
      </div>

      <div id="touch-left" className="touch">
        <button type="button" data-k="tilt" aria-label="Tilt car">
          ◀
        </button>

        <button type="button" data-k="drive" aria-label="Drive car">
          ▶
        </button>
      </div>

      <div id="touch-right" className="touch">
        <button type="button" data-k="jump" aria-label="Jump">
          ⤒
        </button>

        <button type="button" data-k="nitro" aria-label="Nitro boost">
          ⚡
        </button>
      </div>

      <div id="modal" className="hidden">
        <div className="card">
          <span id="m-tag" className="tag">
            ★ COURSE COMPLETE
          </span>

          <h1 id="m-title">STAGE 1 CLEARED</h1>

          <p id="m-text">
            Great driving! Tap anywhere or press ANY key for the next stage.
          </p>

          <button id="m-btn" type="button">
            ▶ NEXT STAGE (SPACE)
          </button>
        </div>
      </div>
    </main>
  );
}
