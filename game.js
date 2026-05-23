/* ============================================================
   SNAKE SHOOTER — Complete Game
   ============================================================ */
;(function () {
  'use strict';

  /* ==========================================================
     SECTION 1: CONSTANTS & CONFIG
     ========================================================== */
  const WORLD_W = 3000;
  const WORLD_H = 2000;
  const BODY_BASE_RADIUS = 10;
  const HEAD_RADIUS = 16;
  const SEGMENT_BASE_SPACING = 24;
  const BASE_SPEED = 200;
  const MAX_SPEED = 320;
  const TURN_RATE = 50;
  const UNIT = 50;

  const BODY_PART_TYPES = {
    fire: {
      color: { h: 27, s: 96, l: 54 },
      sizeMult: 1,
      cooldown: 5,
      damage: 10,
      dot: { dmg: 2, interval: 0.5, ticks: 2 },
      range: 6 * UNIT,
      label: 'FIRE'
    },
    metal: {
      color: { h: 220, s: 8, l: 62 },
      sizeMult: 3,
      cooldown: 2,
      burstCount: 3,
      burstInterval: 0.1,
      damage: 2,
      range: 2 * UNIT,
      label: 'METAL'
    },
    poison: {
      color: { h: 140, s: 70, l: 42 },
      sizeMult: 2,
      cooldown: 3,
      damage: 1,
      dot: { dmg: 10, interval: 0.5, ticks: 2 },
      range: 4 * UNIT,
      label: 'POISON'
    }
  };

  const HEAD_PROJ = {
    damage: 10,
    cooldown: 1.0,
    range: 5 * UNIT,
    color: { h: 262, s: 50, l: 82 }
  };

  const BOX_RESPAWN_TIME = 15;
  const AMMO_RESPAWN_TIME = 10;
  const MAX_AMMO = 20;

  /* ==========================================================
     SECTION 2: DOM ELEMENTS
     ========================================================== */
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  const startScreen = document.getElementById('start-screen');
  const gameoverScreen = document.getElementById('gameover-screen');
  const pauseScreen = document.getElementById('pause-screen');
  const victoryScreen = document.getElementById('victory-screen');

  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const restartBtnV = document.getElementById('victory-restart-btn');

  const scoreValueEl = document.getElementById('score-value');
  const partsValueEl = document.getElementById('parts-value');
  const highScoreEl = document.getElementById('high-score-value');
  const bossHpBar = document.getElementById('boss-hp-bar');
  const bossHpFill = document.getElementById('boss-hp-fill');
  const bossHpMiniFill = document.getElementById('boss-hp-mini-fill');

  const finalScoreEl = document.getElementById('final-score');
  const finalPartsEl = document.getElementById('final-parts');
  const finalDmgEl = document.getElementById('final-damage');

  /* ==========================================================
     SECTION 3: GAME STATE
     ========================================================== */
  let W, H;
  let state = 'menu';

  // Snake
  let headX, headY, headAngle;
  let trail = [];
  let bodyParts = [];
  let bodySegments = [];
  let headShootTimer = 0;
  let speed = BASE_SPEED;

  // World entities
  let projectiles = [];
  let boxes = [];
  let droppedParts = [];
  let ammoPickups = [];
  let boss = null;
  let ammoRocks = [];   // guard rocks in front of ammo zones
  let frogs = [];       // killable frogs that drop perk cards

  // Walls / Alcoves
  let walls = [];

  // Scoring
  let score = 0;
  let totalDmg = 0;
  let highScore = parseInt(localStorage.getItem('snakeshooter-high')) || 0;

  // Timer (5 minutes)
  const GAME_TIME_LIMIT = 600;
  let gameTimer = GAME_TIME_LIMIT;

  // Damage multipliers (perks)
  let dmgMult = { fire: 1, metal: 1, poison: 1 };

  // Perk card state
  let perkActive = false; // true = showing perk cards, game paused
  let perkOptions = [];   // [{type, label, color}]

  // Camera
  let cameraX = 0, cameraY = 0;

  // VFX
  let particles = [];
  let floatingTexts = [];
  let screenShake = { x: 0, y: 0, intensity: 0, timer: 0 };

  // Input
  let mouseX = 0, mouseY = 0;
  let worldMouseX = 0, worldMouseY = 0;

  // Joystick state
  let joystickActive = false;
  let joystickOriginX = 0, joystickOriginY = 0;
  let joystickX = 0, joystickY = 0;
  let joystickAngle = 0;
  let joystickMagnitude = 0;
  const JOYSTICK_MAX_RADIUS = 80;

  // Timing
  let lastTime = 0;
  let gameTime = 0;

  // Menu particles
  let menuParticles = [];

  /* ==========================================================
     SECTION 4: UTILITY FUNCTIONS
     ========================================================== */
  function lerp(a, b, t) { return a + (b - a) * t; }

  function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

  function angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function dist(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  function hsl(h, s, l, a) {
    if (a !== undefined) return `hsla(${h},${s}%,${l}%,${a})`;
    return `hsl(${h},${s}%,${l}%)`;
  }

  function hslObj(c, a) {
    if (a !== undefined) return `hsla(${c.h},${c.s}%,${c.l}%,${a})`;
    return `hsl(${c.h},${c.s}%,${c.l}%)`;
  }

  function randRange(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(randRange(a, b + 1)); }
  function randSign() { return Math.random() < 0.5 ? -1 : 1; }

  function bumped(el) {
    if (!el) return;
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 200);
  }

  /* ==========================================================
     SECTION 5: RESIZE HANDLER
     ========================================================== */
  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
  }
  window.addEventListener('resize', resize);
  resize();

  /* ==========================================================
     SECTION 6: CAMERA SYSTEM
     ========================================================== */
  function updateCamera(dt) {
    const t = 1 - Math.pow(0.001, dt);
    cameraX = lerp(cameraX, headX - W / 2, t);
    cameraY = lerp(cameraY, headY - H / 2, t);

    // Clamp to world bounds
    cameraX = clamp(cameraX, 0, WORLD_W - W);
    cameraY = clamp(cameraY, 0, WORLD_H - H);

    // Screen shake
    if (screenShake.timer > 0) {
      screenShake.timer -= dt;
      screenShake.x = (Math.random() - 0.5) * 2 * screenShake.intensity;
      screenShake.y = (Math.random() - 0.5) * 2 * screenShake.intensity;
      screenShake.intensity *= 0.92;
    } else {
      screenShake.x = 0;
      screenShake.y = 0;
    }
  }

  /* ==========================================================
     SECTION 7: SNAKE MOVEMENT
     ========================================================== */
  function updateSnake(dt) {
    // Calculate joystick angle and magnitude
    joystickAngle = Math.atan2(joystickY - joystickOriginY, joystickX - joystickOriginX);
    joystickMagnitude = Math.hypot(joystickX - joystickOriginX, joystickY - joystickOriginY);

    const isMoving = joystickActive && joystickMagnitude > 10;

    if (isMoving) {
      // Target angle from joystick
      const targetAngle = joystickAngle;

      // Smooth turning
      const diff = angleDiff(headAngle, targetAngle);
      const maxTurn = TURN_RATE * dt;
      headAngle += clamp(diff, -maxTurn, maxTurn);

      // Speed proportional to joystick magnitude
      speed = BASE_SPEED * Math.min(1, joystickMagnitude / JOYSTICK_MAX_RADIUS);
      headX += Math.cos(headAngle) * speed * dt;
      headY += Math.sin(headAngle) * speed * dt;

      // Clamp to world
      headX = clamp(headX, HEAD_RADIUS, WORLD_W - HEAD_RADIUS);
      headY = clamp(headY, HEAD_RADIUS, WORLD_H - HEAD_RADIUS);

      // Wall collision
      for (const wall of walls) {
        const closestX = clamp(headX, wall.x, wall.x + wall.w);
        const closestY = clamp(headY, wall.y, wall.y + wall.h);
        const d = dist(headX, headY, closestX, closestY);
        if (d < HEAD_RADIUS) {
          const pushAngle = Math.atan2(headY - closestY, headX - closestX);
          headX = closestX + Math.cos(pushAngle) * HEAD_RADIUS;
          headY = closestY + Math.sin(pushAngle) * HEAD_RADIUS;
        }
      }
    }

    // Always record trail position (even when not moving)
    trail.unshift({ x: headX, y: headY });

    // Keep trail long enough for all body segments
    const maxTrailLen = bodyParts.length * SEGMENT_BASE_SPACING * 4 + 200;
    if (trail.length > maxTrailLen) trail.length = maxTrailLen;

    // Compute body segments from trail
    computeBodySegments();
  }

  function computeBodySegments() {
    bodySegments = [];
    if (bodyParts.length === 0 || trail.length < 2) return;

    let trailIdx = 0;
    let accumulated = 0;
    let prevX = trail[0].x, prevY = trail[0].y;

    for (let i = 0; i < bodyParts.length; i++) {
      const part = bodyParts[i];
      const cfg = BODY_PART_TYPES[part.type];
      const spacing = SEGMENT_BASE_SPACING * Math.max(1, cfg.sizeMult * 0.7);
      let targetDist = (i === 0) ? spacing : spacing;
      let distToGo = targetDist - accumulated;

      while (distToGo > 0 && trailIdx < trail.length - 1) {
        trailIdx++;
        const segLen = dist(prevX, prevY, trail[trailIdx].x, trail[trailIdx].y);
        if (segLen >= distToGo) {
          const ratio = distToGo / segLen;
          const px = lerp(prevX, trail[trailIdx].x, ratio);
          const py = lerp(prevY, trail[trailIdx].y, ratio);
          bodySegments.push({
            x: px, y: py,
            part: part,
            radius: BODY_BASE_RADIUS * cfg.sizeMult
          });
          prevX = px;
          prevY = py;
          accumulated = 0;
          distToGo = 0;
        } else {
          distToGo -= segLen;
          prevX = trail[trailIdx].x;
          prevY = trail[trailIdx].y;
        }
      }

      if (distToGo > 0) {
        // Trail not long enough, place at end
        bodySegments.push({
          x: prevX, y: prevY,
          part: part,
          radius: BODY_BASE_RADIUS * cfg.sizeMult
        });
        accumulated = 0;
      }
    }
  }

  /* ==========================================================
     SECTION 8: TARGET ACQUISITION
     ========================================================== */
  function findNearestTarget(x, y, range) {
    let bestTarget = null;
    let bestDist = Infinity;

    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (!b.alive || b.hp <= 0) continue;
      const d = dist(x, y, b.x, b.y);
      if (d <= range && d < bestDist) {
        bestDist = d;
        bestTarget = b;
      }
    }

    // Ammo rocks
    for (let i = 0; i < ammoRocks.length; i++) {
      const r = ammoRocks[i];
      if (!r.alive) continue;
      const d = dist(x, y, r.x, r.y);
      if (d <= range && d < bestDist) {
        bestDist = d;
        bestTarget = r;
      }
    }

    // Frogs
    for (let i = 0; i < frogs.length; i++) {
      const f = frogs[i];
      if (!f.alive) continue;
      const d = dist(x, y, f.x, f.y);
      if (d <= range && d < bestDist) {
        bestDist = d;
        bestTarget = f;
      }
    }

    if (boss && boss.alive) {
      const d = dist(x, y, boss.x, boss.y);
      if (d <= range && d < bestDist) {
        bestDist = d;
        bestTarget = boss;
      }
    }

    return bestTarget;
  }

  /* ==========================================================
     SECTION 9: AUTO-SHOOTING SYSTEM
     ========================================================== */
  function updateShooting(dt) {
    // Head shooting
    headShootTimer -= dt;
    if (headShootTimer <= 0) {
      const target = findNearestTarget(headX, headY, HEAD_PROJ.range);
      if (target) {
        spawnProjectile(headX, headY, target, 'default', HEAD_PROJ.damage, null, HEAD_PROJ.range, HEAD_PROJ.color, 9);
        headShootTimer = HEAD_PROJ.cooldown;
      }
    }

    // Body part shooting
    for (let i = 0; i < bodyParts.length; i++) {
      const part = bodyParts[i];
      const cfg = BODY_PART_TYPES[part.type];
      const seg = bodySegments[i];
      if (!seg) continue;

      // Handle burst state for metal
      if (part.burstState) {
        part.burstState.timer -= dt;
        if (part.burstState.timer <= 0 && part.burstState.remaining > 0) {
          if (part.ammo > 0) {
            const target = findNearestTarget(seg.x, seg.y, cfg.range);
            if (target) {
              spawnProjectile(seg.x, seg.y, target, part.type, cfg.damage, null, cfg.range, cfg.color, 9);
            }
            part.ammo--;
            part.burstState.remaining--;
            part.burstState.timer = cfg.burstInterval;
          } else {
            part.burstState = null;
            part.cooldownTimer = cfg.cooldown;
          }

          if (part.burstState && part.burstState.remaining <= 0) {
            part.burstState = null;
            part.cooldownTimer = cfg.cooldown;
          }
        }
        continue;
      }

      part.cooldownTimer -= dt;
      if (part.cooldownTimer <= 0 && part.ammo > 0) {
        const target = findNearestTarget(seg.x, seg.y, cfg.range);
        if (target) {
          if (part.type === 'metal') {
            // Start burst
            part.burstState = { remaining: cfg.burstCount, timer: 0 };
          } else {
            // Fire or Poison: single shot
            const dot = cfg.dot ? { dmg: cfg.dot.dmg, interval: cfg.dot.interval, ticks: cfg.dot.ticks } : null;
            spawnProjectile(seg.x, seg.y, target, part.type, cfg.damage, dot, cfg.range, cfg.color, 15);
            part.ammo--;
            part.cooldownTimer = cfg.cooldown;
          }
        }
      }
    }
  }

  function spawnProjectile(sx, sy, target, type, damage, dot, maxRange, color, radius) {
    const angle = Math.atan2(target.y - sy, target.x - sx);
    const vel = 400;
    projectiles.push({
      x: sx, y: sy,
      vx: Math.cos(angle) * vel,
      vy: Math.sin(angle) * vel,
      type: type,
      damage: damage,
      dot: dot,
      maxRange: maxRange,
      distTraveled: 0,
      radius: radius,
      color: color,
      angle: angle,
      trail: []
    });
  }

  /* ==========================================================
     SECTION 10: PROJECTILE UPDATE
     ========================================================== */
  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];

      // Store trail
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 12) p.trail.shift();

      // Move
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.distTraveled += Math.hypot(p.vx * dt, p.vy * dt);

      // Out of range
      if (p.distTraveled >= p.maxRange || p.x < 0 || p.x > WORLD_W || p.y < 0 || p.y > WORLD_H) {
        projectiles.splice(i, 1);
        continue;
      }

      // Check collision with boxes
      let hit = false;
      for (let j = 0; j < boxes.length; j++) {
        const b = boxes[j];
        if (!b.alive || b.hp <= 0) continue;
        const d = dist(p.x, p.y, b.x, b.y);
        if (d < p.radius + b.size * 0.7) {
          applyDamage(b, p);
          hit = true;
          break;
        }
      }

      if (!hit && boss && boss.alive) {
        const d = dist(p.x, p.y, boss.x, boss.y);
        if (d < p.radius + boss.radius) {
          applyDamage(boss, p);
          hit = true;
        }
      }

      // Check collision with ammo rocks
      if (!hit) {
        for (let j = 0; j < ammoRocks.length; j++) {
          const r = ammoRocks[j];
          if (!r.alive) continue;
          const d = dist(p.x, p.y, r.x, r.y);
          if (d < p.radius + r.radius) {
            applyDamage(r, p);
            hit = true;
            break;
          }
        }
      }

      // Check collision with frogs
      if (!hit) {
        for (let j = 0; j < frogs.length; j++) {
          const f = frogs[j];
          if (!f.alive) continue;
          const d = dist(p.x, p.y, f.x, f.y);
          if (d < p.radius + f.radius) {
            applyDamage(f, p);
            hit = true;
            break;
          }
        }
      }

      // Check wall collision
      if (!hit) {
        for (const wall of walls) {
          if (p.x >= wall.x && p.x <= wall.x + wall.w && p.y >= wall.y && p.y <= wall.y + wall.h) {
            projectiles.splice(i, 1);
            hit = true;
            break;
          }
        }
      }

      if (hit && !projectiles[i]) {
        // already spliced by wall collision
      } else if (hit) {
        projectiles.splice(i, 1);
      }
    }
  }

  function applyDamage(target, projectile) {
    // Apply damage multiplier based on projectile type
    let dmg = projectile.damage;
    if (projectile.type === 'fire') dmg = Math.round(dmg * dmgMult.fire);
    else if (projectile.type === 'metal') dmg = Math.round(dmg * dmgMult.metal);
    else if (projectile.type === 'poison') dmg = Math.round(dmg * dmgMult.poison);

    target.hp -= dmg;
    score += dmg;
    totalDmg += dmg;

    // DOT (also multiplied)
    if (projectile.dot) {
      let dotDmg = projectile.dot.dmg;
      if (projectile.type === 'fire') dotDmg = Math.round(dotDmg * dmgMult.fire);
      else if (projectile.type === 'poison') dotDmg = Math.round(dotDmg * dmgMult.poison);
      target.dots.push({
        damage: dotDmg,
        interval: projectile.dot.interval,
        ticks: projectile.dot.ticks,
        timer: projectile.dot.interval
      });
    }

    // Hit particles
    spawnHitParticles(projectile.x, projectile.y, projectile.color, 6);

    // Floating text
    floatingTexts.push({
      x: projectile.x + randRange(-10, 10),
      y: projectile.y - 10,
      text: `-${dmg}`,
      color: hslObj(projectile.color),
      alpha: 1,
      vy: -60,
      life: 1.0
    });

    // Check box destruction
    if (target.isBox && target.hp <= 0 && target.alive) {
      destroyBox(target);
    }

    // Check ammo rock destruction
    if (target.isRock && target.hp <= 0 && target.alive) {
      destroyAmmoRock(target);
    }

    // Check frog death
    if (target.isFrog && target.hp <= 0 && target.alive) {
      destroyFrog(target);
    }

    // Check boss death
    if (target === boss && boss.hp <= 0) {
      boss.alive = false;
      spawnHitParticles(boss.x, boss.y, { h: 0, s: 80, l: 50 }, 50);
      screenShake.intensity = 15;
      screenShake.timer = 0.6;
      gameVictory();
    }

    // Screen shake
    screenShake.intensity = Math.max(screenShake.intensity, 2);
    screenShake.timer = Math.max(screenShake.timer, 0.1);
  }

  /* ==========================================================
     SECTION 11: DAMAGE & DOT SYSTEM
     ========================================================== */
  function updateDots(dt) {
    const targets = [...boxes.filter(b => b.alive && b.hp > 0),
                     ...ammoRocks.filter(r => r.alive),
                     ...frogs.filter(f => f.alive)];
    if (boss && boss.alive) targets.push(boss);

    for (const target of targets) {
      for (let i = target.dots.length - 1; i >= 0; i--) {
        const dot = target.dots[i];
        dot.timer -= dt;
        if (dot.timer <= 0) {
          target.hp -= dot.damage;
          score += dot.damage;
          totalDmg += dot.damage;
          dot.ticks--;
          dot.timer = dot.interval;

          // DOT tick particles
          spawnHitParticles(target.x + randRange(-15, 15), target.y + randRange(-15, 15),
            { h: 120, s: 70, l: 50 }, 2);

          floatingTexts.push({
            x: target.x + randRange(-20, 20),
            y: target.y - 15,
            text: `-${dot.damage}`,
            color: hsl(120, 70, 50),
            alpha: 0.8,
            vy: -40,
            life: 0.7
          });

          if (dot.ticks <= 0) {
            target.dots.splice(i, 1);
          }

          // Check destruction by DOT
          if (target.hp <= 0 && target.alive) {
            if (target.isBox) destroyBox(target);
            else if (target.isRock) destroyAmmoRock(target);
            else if (target.isFrog) destroyFrog(target);
            else if (target === boss) {
              boss.alive = false;
              spawnHitParticles(boss.x, boss.y, { h: 0, s: 80, l: 50 }, 50);
              screenShake.intensity = 15;
              screenShake.timer = 0.6;
              gameVictory();
            }
          }
        }
      }
    }
  }

  /* ==========================================================
     SECTION 12: DESTRUCTIBLE BOXES
     ========================================================== */
  function createBoxes() {
    boxes = [];
    const configs = [
      { hp: 100, size: 28 },
      { hp: 100, size: 28 },
      { hp: 100, size: 28 },
      { hp: 500, size: 42 },
      { hp: 500, size: 42 },
      { hp: 500, size: 42 }
    ];

    // Place some boxes inside alcoves
    const alcoveCenters = getAlcoveCenters();
    let alcoveIdx = 0;

    for (let ci = 0; ci < configs.length; ci++) {
      const cfg = configs[ci];
      let pos;
      if (alcoveIdx < alcoveCenters.length && ci < 3) {
        // Place first 3 boxes in alcoves
        pos = { x: alcoveCenters[alcoveIdx].x + randRange(-20, 20), y: alcoveCenters[alcoveIdx].y + randRange(-20, 20) };
        alcoveIdx++;
      } else {
        pos = findBoxSpawnPos(cfg.size);
      }
      boxes.push({
        x: pos.x, y: pos.y,
        hp: cfg.hp, maxHp: cfg.hp,
        size: cfg.size,
        alive: true,
        isBox: true,
        dots: [],
        respawnTimer: 0,
        destroyed: false
      });
    }
  }

  function getAlcoveCenters() {
    // Calculate interior center of each alcove from wall layout
    // Alcove 1: U-shape opening right at (600, 300)
    // Alcove 2: U-shape opening left at (1600, 500)
    // Alcove 3: U-shape opening down at (2200, 700)
    // Alcove 4: L-shape at (1200, 1100)
    // Alcove 5: U-shape opening down at (1900, 200)
    return [
      { x: 700, y: 425 },      // alcove 1 center
      { x: 1700, y: 625 },     // alcove 2 center
      { x: 2325, y: 800 },     // alcove 3 center
      { x: 1325, y: 1240 },    // alcove 4 center
      { x: 2040, y: 300 }      // alcove 5 center
    ];
  }

  function findBoxSpawnPos(size) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const x = randRange(200, WORLD_W - 200);
      const y = randRange(200, WORLD_H - 400);

      // Avoid boss area
      if (boss && dist(x, y, boss.x, boss.y) < 200) continue;

      // Avoid snake start
      if (dist(x, y, 200, 200) < 200) continue;

      // Avoid other boxes
      let tooClose = false;
      for (const b of boxes) {
        if (b.alive && dist(x, y, b.x, b.y) < 120) { tooClose = true; break; }
      }
      if (tooClose) continue;

      // Avoid walls
      let insideWall = false;
      for (const wall of walls) {
        if (x >= wall.x - size && x <= wall.x + wall.w + size &&
            y >= wall.y - size && y <= wall.y + wall.h + size) {
          insideWall = true;
          break;
        }
      }
      if (insideWall) continue;

      return { x, y };
    }
    return { x: randRange(300, WORLD_W - 300), y: randRange(300, WORLD_H - 500) };
  }

  function destroyBox(box) {
    box.alive = false;
    box.destroyed = true;
    box.respawnTimer = BOX_RESPAWN_TIME;

    // Spawn 2 dropped parts
    const types = ['fire', 'metal', 'poison'];
    for (let j = 0; j < 2; j++) {
      const type = types[randInt(0, 2)];
      droppedParts.push({
        x: box.x + randRange(-30, 30),
        y: box.y + randRange(-30, 30),
        type: type,
        bobPhase: Math.random() * Math.PI * 2
      });
    }

    // Burst particles
    spawnHitParticles(box.x, box.y, { h: 40, s: 80, l: 55 }, 20);
    screenShake.intensity = 6;
    screenShake.timer = 0.3;
  }

  function updateBoxes(dt) {
    for (const box of boxes) {
      if (box.destroyed && !box.alive) {
        box.respawnTimer -= dt;
        if (box.respawnTimer <= 0) {
          // Respawn
          const pos = findBoxSpawnPos(box.size);
          box.x = pos.x;
          box.y = pos.y;
          box.hp = box.maxHp;
          box.alive = true;
          box.destroyed = false;
          box.dots = [];
        }
      }
    }
  }

  /* ==========================================================
     SECTION 13: DROPPED PARTS (LOOT)
     ========================================================== */
  function updateDroppedParts(dt) {
    for (let i = droppedParts.length - 1; i >= 0; i--) {
      const dp = droppedParts[i];
      dp.bobPhase += dt * 2.5;

      // Check collision with snake head
      const d = dist(headX, headY, dp.x, dp.y);
      if (d < HEAD_RADIUS + 18) {
        // Add to body parts — insert next to same type for grouping
        const newPart = { type: dp.type, ammo: 0, cooldownTimer: 0, burstState: null };
        let insertIdx = -1;
        for (let k = bodyParts.length - 1; k >= 0; k--) {
          if (bodyParts[k].type === dp.type) { insertIdx = k + 1; break; }
        }
        if (insertIdx === -1) {
          bodyParts.push(newPart);
        } else {
          bodyParts.splice(insertIdx, 0, newPart);
        }
        droppedParts.splice(i, 1);

        // Pickup particles
        const cfg = BODY_PART_TYPES[dp.type];
        spawnHitParticles(dp.x, dp.y, cfg.color, 10);

        floatingTexts.push({
          x: dp.x, y: dp.y - 20,
          text: `+${cfg.label}`,
          color: hslObj(cfg.color),
          alpha: 1, vy: -50, life: 1.2
        });
      }
    }
  }

  /* ==========================================================
     SECTION 14: BOSS
     ========================================================== */
  function createBoss() {
    boss = {
      x: WORLD_W - 400,
      y: 400,
      hp: 20000,
      maxHp: 20000,
      radius: 60,
      dots: [],
      alive: true,
      auraPhase: 0
    };
  }

  function updateBoss(dt) {
    if (!boss || !boss.alive) return;
    boss.auraPhase += dt;
  }

  /* ==========================================================
     SECTION 15: AMMO COLLECTIBLES
     ========================================================== */
  function createAmmoPickups() {
    ammoPickups = [];
    const zones = [
      { type: 'fire', cx: 400, cy: WORLD_H - 300 },
      { type: 'poison', cx: WORLD_W / 2, cy: WORLD_H - 300 },
      { type: 'metal', cx: WORLD_W - 400, cy: WORLD_H - 300 }
    ];

    for (const zone of zones) {
      for (let i = 0; i < 32; i++) {
        const angle = (i / 32) * Math.PI * 2;
        const r = randRange(30, 150);
        ammoPickups.push({
          x: zone.cx + Math.cos(angle) * r,
          y: zone.cy + Math.sin(angle) * r,
          type: zone.type,
          collected: false,
          respawnTimer: 0
        });
      }
    }
  }

  function updateAmmoPickups(dt) {
    for (const pickup of ammoPickups) {
      if (pickup.collected) {
        pickup.respawnTimer -= dt;
        if (pickup.respawnTimer <= 0) {
          pickup.collected = false;
        }
        continue;
      }

      // Check collision with snake head
      const d = dist(headX, headY, pickup.x, pickup.y);
      if (d < HEAD_RADIUS + 12) {
        // Find matching body parts
        const matching = bodyParts.filter(bp => bp.type === pickup.type && bp.ammo < MAX_AMMO);
        if (matching.length > 0) {
          // Add to lowest ammo count
          matching.sort((a, b) => a.ammo - b.ammo);
          matching[0].ammo++;
          pickup.collected = true;
          pickup.respawnTimer = AMMO_RESPAWN_TIME;

          // Pickup effect
          const cfg = BODY_PART_TYPES[pickup.type];
          spawnHitParticles(pickup.x, pickup.y, cfg.color, 4);
          floatingTexts.push({
            x: pickup.x, y: pickup.y - 10,
            text: '+1 AMMO',
            color: hslObj(cfg.color),
            alpha: 1, vy: -40, life: 0.8
          });
        }
      }
    }
  }

  /* ==========================================================
     SECTION 15B: AMMO ROCKS (Zone Guards)
     ========================================================== */
  function createAmmoRocks() {
    ammoRocks = [];
    const zones = [
      { type: 'fire', cx: 400, cy: WORLD_H - 300 },
      { type: 'poison', cx: WORLD_W / 2, cy: WORLD_H - 300 },
      { type: 'metal', cx: WORLD_W - 400, cy: WORLD_H - 300 }
    ];
    for (const zone of zones) {
      ammoRocks.push({
        x: zone.cx, y: zone.cy - 170,
        hp: 200, maxHp: 200,
        radius: 28,
        type: zone.type,
        alive: true,
        isRock: true,
        dots: [],
        respawnTimer: 0,
        destroyed: false
      });
    }
  }

  function destroyAmmoRock(rock) {
    rock.alive = false;
    rock.destroyed = true;
    rock.respawnTimer = 20;

    // Scatter 50 ammo pickups of matching type
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = randRange(20, 180);
      ammoPickups.push({
        x: rock.x + Math.cos(angle) * r,
        y: rock.y + Math.sin(angle) * r,
        type: rock.type,
        collected: false,
        respawnTimer: 0
      });
    }

    spawnHitParticles(rock.x, rock.y, BODY_PART_TYPES[rock.type].color, 30);
    screenShake.intensity = 8;
    screenShake.timer = 0.4;
    floatingTexts.push({
      x: rock.x, y: rock.y - 30,
      text: '+50 AMMO!',
      color: hslObj(BODY_PART_TYPES[rock.type].color),
      alpha: 1, vy: -50, life: 1.5
    });
  }

  function updateAmmoRocks(dt) {
    for (const rock of ammoRocks) {
      if (rock.destroyed && !rock.alive) {
        rock.respawnTimer -= dt;
        if (rock.respawnTimer <= 0) {
          rock.hp = rock.maxHp;
          rock.alive = true;
          rock.destroyed = false;
          rock.dots = [];
        }
      }
    }
  }

  /* ==========================================================
     SECTION 15C: FROGS (Perk Droppers)
     ========================================================== */
  function createFrogs() {
    frogs = [];
    const frogPositions = [
      { x: 700, y: 420 },     // near alcove 1
      { x: 1700, y: 620 },    // near alcove 2
      { x: 2300, y: 820 },    // near alcove 3
      { x: 1300, y: 1250 },   // near alcove 4
    ];
    for (const pos of frogPositions) {
      frogs.push({
        x: pos.x, y: pos.y,
        hp: 200, maxHp: 200,
        radius: 20,
        alive: true,
        isFrog: true,
        dots: [],
        respawnTimer: 0,
        destroyed: false,
        bobPhase: Math.random() * Math.PI * 2
      });
    }
  }

  function destroyFrog(frog) {
    frog.alive = false;
    frog.destroyed = true;
    frog.respawnTimer = 25;

    spawnHitParticles(frog.x, frog.y, { h: 120, s: 80, l: 45 }, 20);
    screenShake.intensity = 5;
    screenShake.timer = 0.3;

    // Show perk cards
    perkActive = true;
    perkOptions = [
      { type: 'fire',   label: 'Fire DMG +100%',   color: BODY_PART_TYPES.fire.color },
      { type: 'metal',  label: 'Metal DMG +100%',   color: BODY_PART_TYPES.metal.color },
      { type: 'poison', label: 'Poison DMG +100%',  color: BODY_PART_TYPES.poison.color }
    ];
  }

  function selectPerk(type) {
    dmgMult[type] += 1;
    perkActive = false;
    perkOptions = [];

    floatingTexts.push({
      x: headX, y: headY - 40,
      text: `${type.toUpperCase()} DMG x${dmgMult[type]}!`,
      color: hslObj(BODY_PART_TYPES[type].color),
      alpha: 1, vy: -60, life: 2.0
    });
  }

  function updateFrogs(dt) {
    for (const frog of frogs) {
      if (frog.alive) {
        frog.bobPhase += dt * 2;
      }
      if (frog.destroyed && !frog.alive) {
        frog.respawnTimer -= dt;
        if (frog.respawnTimer <= 0) {
          frog.hp = frog.maxHp;
          frog.alive = true;
          frog.destroyed = false;
          frog.dots = [];
        }
      }
    }
  }

  /* ==========================================================
     SECTION 15D: PERK CARDS RENDERING
     ========================================================== */
  function renderPerkCards() {
    if (!perkActive || perkOptions.length === 0) return;

    // Dim overlay
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.font = 'bold 28px Outfit, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('CHOOSE A PERK', W / 2, H / 2 - 120);

    // Cards
    const cardW = 160, cardH = 200, gap = 30;
    const totalW = perkOptions.length * cardW + (perkOptions.length - 1) * gap;
    const startX = (W - totalW) / 2;

    for (let i = 0; i < perkOptions.length; i++) {
      const opt = perkOptions[i];
      const cx = startX + i * (cardW + gap) + cardW / 2;
      const cy = H / 2 + 20;
      const x = cx - cardW / 2, y = cy - cardH / 2;

      // Check hover
      const hovered = mouseX >= x && mouseX <= x + cardW && mouseY >= y && mouseY <= y + cardH;

      // Card background
      ctx.save();
      if (hovered) {
        ctx.shadowColor = hslObj(opt.color, 0.8);
        ctx.shadowBlur = 20;
      }
      const cardGrad = ctx.createLinearGradient(x, y, x, y + cardH);
      cardGrad.addColorStop(0, hovered ? hsl(opt.color.h, opt.color.s, 25) : 'rgba(20,20,35,0.95)');
      cardGrad.addColorStop(1, hovered ? hsl(opt.color.h, opt.color.s, 15) : 'rgba(15,15,25,0.95)');
      ctx.fillStyle = cardGrad;
      drawRoundedRect(x, y, cardW, cardH, 12);
      ctx.fill();

      // Border
      ctx.strokeStyle = hovered ? hslObj(opt.color, 0.8) : hslObj(opt.color, 0.3);
      ctx.lineWidth = hovered ? 2.5 : 1.5;
      drawRoundedRect(x, y, cardW, cardH, 12);
      ctx.stroke();
      ctx.restore();

      // Icon circle
      const iconR = 28;
      draw3DOrb(cx, cy - 35, iconR, opt.color, hovered ? 0.8 : 0.3);

      // Draw type icon
      drawPartIcon(cx, cy - 35, opt.type, iconR);

      // Current multiplier
      ctx.font = 'bold 16px Outfit, sans-serif';
      ctx.fillStyle = hslObj(opt.color);
      ctx.textAlign = 'center';
      ctx.fillText(`x${dmgMult[opt.type]}→x${dmgMult[opt.type] + 1}`, cx, cy + 25);

      // Label
      ctx.font = '600 13px Outfit, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(opt.label, cx, cy + 55);

      // Hint
      if (hovered) {
        ctx.font = '500 11px Outfit, sans-serif';
        ctx.fillStyle = hslObj(opt.color, 0.7);
        ctx.fillText('Click to select', cx, cy + 80);
      }
    }
  }

  function handlePerkClick(mx, my) {
    if (!perkActive) return false;
    const cardW = 160, cardH = 200, gap = 30;
    const totalW = perkOptions.length * cardW + (perkOptions.length - 1) * gap;
    const startX = (W - totalW) / 2;

    for (let i = 0; i < perkOptions.length; i++) {
      const x = startX + i * (cardW + gap);
      const y = H / 2 + 20 - cardH / 2;
      if (mx >= x && mx <= x + cardW && my >= y && my <= y + cardH) {
        selectPerk(perkOptions[i].type);
        return true;
      }
    }
    return false;
  }

  /* ==========================================================
     SECTION 15E: GAME TIMER
     ========================================================== */
  function renderTimer() {
    const mins = Math.floor(Math.max(0, gameTimer) / 60);
    const secs = Math.floor(Math.max(0, gameTimer) % 60);
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    const urgency = gameTimer < 30;

    ctx.save();
    ctx.font = `bold ${urgency ? 30 : 22}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = urgency ? `rgba(255,${60 + Math.sin(gameTime * 6) * 40},50,0.95)` : 'rgba(255,255,255,0.7)';
    if (urgency) {
      ctx.shadowColor = 'rgba(255,50,50,0.5)';
      ctx.shadowBlur = 10;
    }
    ctx.fillText(timeStr, W / 2, 90);
    ctx.restore();
  }

  /* ==========================================================
     SECTION 16: PARTICLES & VFX
     ========================================================== */
  function spawnHitParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = randRange(30, 150);
      particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        radius: randRange(1.5, 4),
        color: color,
        alpha: 1,
        life: randRange(0.3, 0.8),
        maxLife: 0
      });
      particles[particles.length - 1].maxLife = particles[particles.length - 1].life;
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function updateFloatingTexts(dt) {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      ft.alpha = Math.max(0, ft.life / 1.2);
      if (ft.life <= 0) floatingTexts.splice(i, 1);
    }
  }

  /* ==========================================================
     SECTION 17: SELF-COLLISION
     ========================================================== */
  function checkSelfCollision() {
    // Disabled — snake can pass through itself for sharp turning gameplay
  }

  /* ==========================================================
     SECTION 18: RENDERING — HELPERS
     ========================================================== */
  function draw3DOrb(x, y, radius, color, glowIntensity) {
    const c = color;
    const glow = glowIntensity || 0;

    // Shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + radius * 0.8, radius * 0.8, radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Optional glow
    if (glow > 0) {
      ctx.save();
      ctx.globalAlpha = 0.3 * glow;
      ctx.shadowColor = hslObj(c);
      ctx.shadowBlur = radius * 2;
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.3, 0, Math.PI * 2);
      ctx.fillStyle = hslObj(c, 0.2);
      ctx.fill();
      ctx.restore();
    }

    // Main body gradient
    const grad = ctx.createRadialGradient(
      x - radius * 0.3, y - radius * 0.3, radius * 0.1,
      x, y, radius
    );
    grad.addColorStop(0, hsl(c.h, c.s, Math.min(c.l + 30, 95)));
    grad.addColorStop(0.5, hslObj(c));
    grad.addColorStop(1, hsl(c.h, c.s, Math.max(c.l - 20, 10)));

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Rim light
    const rimGrad = ctx.createRadialGradient(x, y, radius * 0.8, x, y, radius);
    rimGrad.addColorStop(0, 'rgba(255,255,255,0)');
    rimGrad.addColorStop(0.8, 'rgba(255,255,255,0)');
    rimGrad.addColorStop(1, 'rgba(255,255,255,0.12)');
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = rimGrad;
    ctx.fill();

    // Specular highlight
    const specGrad = ctx.createRadialGradient(
      x - radius * 0.25, y - radius * 0.3, 0,
      x - radius * 0.25, y - radius * 0.3, radius * 0.5
    );
    specGrad.addColorStop(0, 'rgba(255,255,255,0.55)');
    specGrad.addColorStop(0.4, 'rgba(255,255,255,0.15)');
    specGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = specGrad;
    ctx.fill();

    // Sharp specular dot
    ctx.beginPath();
    ctx.arc(x - radius * 0.2, y - radius * 0.25, radius * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
  }

  function drawRoundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawHPBar(x, y, w, h, hp, maxHp) {
    const pct = Math.max(0, hp / maxHp);
    const barW = w * pct;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    drawRoundedRect(x - w / 2, y, w, h, 2);
    ctx.fill();

    // Bar color
    let barColor;
    if (pct > 0.6) barColor = hsl(120, 70, 45);
    else if (pct > 0.3) barColor = hsl(50, 80, 50);
    else barColor = hsl(0, 80, 50);

    ctx.fillStyle = barColor;
    if (barW > 0) {
      drawRoundedRect(x - w / 2, y, barW, h, 2);
      ctx.fill();
    }

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.5;
    drawRoundedRect(x - w / 2, y, w, h, 2);
    ctx.stroke();
  }

  /* ==========================================================
     SECTION 19: RENDERING — WORLD
     ========================================================== */
  function renderBackground() {
    // Gradient background
    const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    grad.addColorStop(0, '#0e0e1a');
    grad.addColorStop(1, '#060610');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function renderGrid() {
    const gridSize = 80;
    const startX = Math.floor(cameraX / gridSize) * gridSize;
    const startY = Math.floor(cameraY / gridSize) * gridSize;

    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;

    for (let x = startX; x < cameraX + W + gridSize; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, cameraY);
      ctx.lineTo(x, cameraY + H);
      ctx.stroke();
    }
    for (let y = startY; y < cameraY + H + gridSize; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(cameraX, y);
      ctx.lineTo(cameraX + W, y);
      ctx.stroke();
    }
  }

  function renderWorldBorder() {
    ctx.strokeStyle = 'rgba(124,58,237,0.4)';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(124,58,237,0.6)';
    ctx.shadowBlur = 15;
    ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
    ctx.shadowBlur = 0;
  }

  function renderWalls() {
    for (const wall of walls) {
      // Wall body
      const grad = ctx.createLinearGradient(wall.x, wall.y, wall.x + wall.w, wall.y + wall.h);
      grad.addColorStop(0, 'hsl(240, 10%, 22%)');
      grad.addColorStop(1, 'hsl(240, 10%, 16%)');
      ctx.fillStyle = grad;
      drawRoundedRect(wall.x, wall.y, wall.w, wall.h, 3);
      ctx.fill();

      // Border glow
      ctx.strokeStyle = 'rgba(124,58,237,0.2)';
      ctx.lineWidth = 1;
      drawRoundedRect(wall.x, wall.y, wall.w, wall.h, 3);
      ctx.stroke();

      // Top highlight
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(wall.x + 2, wall.y + 1, wall.w - 4, Math.min(wall.h, 4));
    }
  }

  function renderAmmoZones() {
    const zones = [
      { cx: 400, cy: WORLD_H - 300, type: 'fire' },
      { cx: WORLD_W / 2, cy: WORLD_H - 300, type: 'poison' },
      { cx: WORLD_W - 400, cy: WORLD_H - 300, type: 'metal' }
    ];

    for (const zone of zones) {
      const cfg = BODY_PART_TYPES[zone.type];
      const c = cfg.color;

      // Subtle zone circle
      ctx.save();
      ctx.globalAlpha = 0.06;
      const grad = ctx.createRadialGradient(zone.cx, zone.cy, 0, zone.cx, zone.cy, 160);
      grad.addColorStop(0, hslObj(c, 0.4));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(zone.cx, zone.cy, 160, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Label
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.font = '600 12px Outfit, sans-serif';
      ctx.fillStyle = hslObj(c);
      ctx.textAlign = 'center';
      ctx.fillText(cfg.label + ' ZONE', zone.cx, zone.cy - 140);
      ctx.restore();
    }
  }

  function renderAmmoPickups() {
    for (const pickup of ammoPickups) {
      if (pickup.collected) continue;
      const cfg = BODY_PART_TYPES[pickup.type];
      const c = cfg.color;
      const bob = Math.sin(gameTime * 3 + pickup.x) * 3;

      ctx.save();
      ctx.translate(pickup.x, pickup.y + bob);

      // Glow
      ctx.globalAlpha = 0.3;
      ctx.shadowColor = hslObj(c);
      ctx.shadowBlur = 8;

      ctx.fillStyle = hslObj(c);
      ctx.globalAlpha = 0.9;

      if (pickup.type === 'fire') {
        // Small orange rectangle
        ctx.fillRect(-4, -6, 8, 12);
      } else if (pickup.type === 'metal') {
        // Small grey triangle
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(5, 5);
        ctx.lineTo(-5, 5);
        ctx.closePath();
        ctx.fill();
      } else {
        // Small green circle
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  function renderBoxes() {
    for (const box of boxes) {
      if (!box.alive) continue;

      const half = box.size / 2;
      const pct = box.hp / box.maxHp;

      // Box gradient
      let grad;
      if (box.maxHp <= 100) {
        // Small box: golden-brown
        grad = ctx.createLinearGradient(box.x - half, box.y - half, box.x + half, box.y + half);
        grad.addColorStop(0, hsl(35, 60, 45));
        grad.addColorStop(1, hsl(25, 50, 30));
      } else {
        // Large box: steel-blue
        grad = ctx.createLinearGradient(box.x - half, box.y - half, box.x + half, box.y + half);
        grad.addColorStop(0, hsl(210, 40, 50));
        grad.addColorStop(1, hsl(220, 35, 30));
      }

      ctx.fillStyle = grad;
      drawRoundedRect(box.x - half, box.y - half, box.size, box.size, 5);
      ctx.fill();

      // Border
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1.5;
      drawRoundedRect(box.x - half, box.y - half, box.size, box.size, 5);
      ctx.stroke();

      // "?" symbol
      ctx.font = `bold ${box.size * 0.5}px Outfit, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', box.x, box.y);

      // Crack lines when HP < 50%
      if (pct < 0.5) {
        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(box.x - half * 0.6, box.y - half * 0.3);
        ctx.lineTo(box.x, box.y + half * 0.2);
        ctx.lineTo(box.x + half * 0.4, box.y - half * 0.5);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(box.x + half * 0.2, box.y + half * 0.3);
        ctx.lineTo(box.x - half * 0.3, box.y + half * 0.6);
        ctx.stroke();
        ctx.restore();
      }

      // HP bar
      if (box.hp < box.maxHp) {
        drawHPBar(box.x, box.y - half - 12, box.size + 10, 4, box.hp, box.maxHp);
      }
    }
  }

  function renderAmmoRocks() {
    for (const rock of ammoRocks) {
      if (!rock.alive) continue;
      const cfg = BODY_PART_TYPES[rock.type];

      // Rock body — irregular boulder shape using 3D orb
      ctx.save();
      ctx.shadowColor = hslObj(cfg.color, 0.4);
      ctx.shadowBlur = 12;

      // Draw rocky shape (squished orb)
      const r = rock.radius;
      const grad = ctx.createRadialGradient(rock.x - r * 0.3, rock.y - r * 0.3, r * 0.1,
                                             rock.x, rock.y, r);
      grad.addColorStop(0, hsl(cfg.color.h, cfg.color.s, cfg.color.l + 15));
      grad.addColorStop(0.7, hslObj(cfg.color));
      grad.addColorStop(1, hsl(cfg.color.h, cfg.color.s, cfg.color.l - 20));
      ctx.fillStyle = grad;

      // Bumpy boulder outline
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.3) {
        const wobble = r + Math.sin(a * 3.7) * 4 + Math.cos(a * 5.1) * 3;
        const px = rock.x + Math.cos(a) * wobble;
        const py = rock.y + Math.sin(a) * wobble;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.ellipse(rock.x - 5, rock.y - 8, r * 0.5, r * 0.3, -0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Rock label
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.fillStyle = hslObj(cfg.color, 0.8);
      ctx.textAlign = 'center';
      ctx.fillText(cfg.label + ' ROCK', rock.x, rock.y + r + 18);

      // HP bar
      if (rock.hp < rock.maxHp) {
        drawHPBar(rock.x, rock.y - r - 10, 50, 4, rock.hp, rock.maxHp);
      }
    }
  }

  function renderFrogs() {
    for (const frog of frogs) {
      if (!frog.alive) continue;

      const r = frog.radius;
      const bobY = Math.sin(frog.bobPhase) * 3;

      ctx.save();

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(frog.x, frog.y + r + 2, r * 0.8, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body (green oval)
      const bodyGrad = ctx.createRadialGradient(frog.x - 3, frog.y + bobY - 4, 2,
                                                 frog.x, frog.y + bobY, r);
      bodyGrad.addColorStop(0, 'hsl(120, 70%, 55%)');
      bodyGrad.addColorStop(0.7, 'hsl(120, 60%, 38%)');
      bodyGrad.addColorStop(1, 'hsl(120, 50%, 22%)');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(frog.x, frog.y + bobY, r, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Belly
      ctx.fillStyle = 'hsl(80, 50%, 55%)';
      ctx.beginPath();
      ctx.ellipse(frog.x, frog.y + bobY + 4, r * 0.5, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eyes (two big circles on top)
      for (const side of [-1, 1]) {
        const ex = frog.x + side * r * 0.4;
        const ey = frog.y + bobY - r * 0.6;

        // Eye white
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex, ey, 6, 0, Math.PI * 2);
        ctx.fill();

        // Pupil
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(ex + side, ey + 1, 3, 0, Math.PI * 2);
        ctx.fill();

        // Specular
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(ex + side * 0.5 - 1, ey - 1.5, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Mouth (smile)
      ctx.strokeStyle = 'hsl(120, 40%, 25%)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(frog.x, frog.y + bobY + 2, 7, 0.2, Math.PI - 0.2);
      ctx.stroke();

      ctx.restore();

      // Label
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.fillStyle = 'rgba(100,255,100,0.8)';
      ctx.textAlign = 'center';
      ctx.fillText('FROG', frog.x, frog.y + r + 18);

      // HP bar
      if (frog.hp < frog.maxHp) {
        drawHPBar(frog.x, frog.y - r - 14, 40, 4, frog.hp, frog.maxHp);
      }
    }
  }

  function renderDroppedParts() {
    for (const dp of droppedParts) {
      const cfg = BODY_PART_TYPES[dp.type];
      const bob = Math.sin(dp.bobPhase) * 5;
      const pulse = 1 + Math.sin(dp.bobPhase * 1.5) * 0.1;

      draw3DOrb(dp.x, dp.y + bob, 12 * pulse, cfg.color, 0.5);

      // Label
      ctx.font = '600 10px Outfit, sans-serif';
      ctx.fillStyle = hslObj(cfg.color, 0.8);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(cfg.label, dp.x, dp.y + bob - 18);
    }
  }

  function renderBoss() {
    if (!boss || !boss.alive) return;

    const bx = boss.x, by = boss.y, br = boss.radius;

    // Rotating aura rings
    ctx.save();
    for (let ring = 0; ring < 3; ring++) {
      const ringAngle = boss.auraPhase * (0.3 + ring * 0.2) + ring * (Math.PI / 3);
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(ringAngle);

      ctx.strokeStyle = `hsla(0, 70%, ${40 + ring * 10}%, ${0.08 + ring * 0.03})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, br * (1.4 + ring * 0.3), br * (0.4 + ring * 0.15), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // Subtle pulsing glow
    const pulseR = br * (1.3 + Math.sin(boss.auraPhase * 2) * 0.1);
    const glowGrad = ctx.createRadialGradient(bx, by, br * 0.5, bx, by, pulseR);
    glowGrad.addColorStop(0, 'rgba(180,20,20,0.15)');
    glowGrad.addColorStop(1, 'rgba(180,20,20,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(bx, by, pulseR, 0, Math.PI * 2);
    ctx.fill();

    // Main boss orb (dark crimson)
    draw3DOrb(bx, by, br, { h: 0, s: 75, l: 30 }, 0.5);

    // Glowing eye/core
    const eyeGrad = ctx.createRadialGradient(bx, by, 0, bx, by, br * 0.35);
    eyeGrad.addColorStop(0, 'rgba(255,60,30,0.9)');
    eyeGrad.addColorStop(0.5, 'rgba(200,20,20,0.4)');
    eyeGrad.addColorStop(1, 'rgba(200,20,20,0)');
    ctx.fillStyle = eyeGrad;
    ctx.beginPath();
    ctx.arc(bx, by, br * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.arc(bx, by, br * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // HP bar
    const hpBarW = 120;
    drawHPBar(bx, by - br - 20, hpBarW, 6, boss.hp, boss.maxHp);

    // HP text
    ctx.font = '600 11px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText(`BOSS ${Math.max(0, Math.ceil(boss.hp / boss.maxHp * 100))}%`, bx, by - br - 24);
  }

  /* ==========================================================
     SECTION 20: RENDERING — SNAKE
     ========================================================== */

  function drawPartIcon(x, y, type, radius) {
    const s = radius * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.8;

    if (type === 'fire') {
      // Flame icon
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.8);
      ctx.quadraticCurveTo(x + s * 0.6, y - s * 0.2, x + s * 0.3, y + s * 0.5);
      ctx.quadraticCurveTo(x, y + s * 0.2, x, y + s * 0.5);
      ctx.quadraticCurveTo(x, y + s * 0.2, x - s * 0.3, y + s * 0.5);
      ctx.quadraticCurveTo(x - s * 0.6, y - s * 0.2, x, y - s * 0.8);
      ctx.fill();
    } else if (type === 'metal') {
      // Triple horizontal lines (burst symbol)
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(x - s * 0.5, y + i * s * 0.4);
        ctx.lineTo(x + s * 0.5, y + i * s * 0.4);
        ctx.stroke();
      }
    } else if (type === 'poison') {
      // Droplet shape
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.7);
      ctx.quadraticCurveTo(x + s * 0.6, y + s * 0.1, x, y + s * 0.6);
      ctx.quadraticCurveTo(x - s * 0.6, y + s * 0.1, x, y - s * 0.7);
      ctx.fill();
    }

    ctx.restore();
  }

  function renderRangeCircles() {
    for (let i = 0; i < bodySegments.length; i++) {
      const seg = bodySegments[i];
      const cfg = BODY_PART_TYPES[seg.part.type];

      // Only show range if part has ammo
      if (seg.part.ammo <= 0) continue;

      ctx.save();
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = hslObj(cfg.color, 0.2);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, cfg.range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Head range circle (always active)
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(200,180,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(headX, headY, HEAD_PROJ.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function renderSnakeBody() {
    // Render tail to head for proper overlapping
    for (let i = bodySegments.length - 1; i >= 0; i--) {
      const seg = bodySegments[i];
      const cfg = BODY_PART_TYPES[seg.part.type];

      draw3DOrb(seg.x, seg.y, seg.radius, cfg.color, 0.2);

      // Draw part icon on top
      drawPartIcon(seg.x, seg.y, seg.part.type, seg.radius);

      // Ammo stack above segment
      if (seg.part.ammo > 0) {
        renderAmmoStack(seg.x, seg.y - seg.radius - 2, seg.part.type, seg.part.ammo, i);
      }
    }
  }

  function renderAmmoStack(x, y, type, ammo, segIdx) {
    const cfg = BODY_PART_TYPES[type];
    const c = cfg.color;
    const stackCount = Math.min(ammo, 20);
    const itemH = 14;
    const gap = 1;

    // Wiggle based on snake movement — each segment wiggles differently
    const wigglePhase = gameTime * 6 + (segIdx || 0) * 1.3;
    const wiggleAmp = joystickActive ? 3.5 : 0.8;

    ctx.save();

    for (let j = 0; j < stackCount; j++) {
      const wiggleX = Math.sin(wigglePhase + j * 0.5) * wiggleAmp;
      const sy = y - j * (itemH + gap);
      const px = x + wiggleX;

      // 3D shadow for each object
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      if (type === 'fire') {
        ctx.fillRect(px - 4 + 1, sy - 8 + 1, 8, itemH);
      } else if (type === 'metal') {
        ctx.beginPath();
        ctx.moveTo(px + 1, sy - 10 + 1);
        ctx.lineTo(px + 7, sy + 2 + 1);
        ctx.lineTo(px - 5, sy + 2 + 1);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(px + 1, sy - 2 + 1, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Main object with gradient for 3D look
      if (type === 'fire') {
        const g = ctx.createLinearGradient(px - 4, sy - 8, px + 4, sy - 8 + itemH);
        g.addColorStop(0, hsl(c.h, c.s, Math.min(c.l + 20, 90)));
        g.addColorStop(1, hsl(c.h, c.s, c.l - 10));
        ctx.fillStyle = g;
        ctx.fillRect(px - 4, sy - 8, 8, itemH);
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(px - 3, sy - 7, 3, 4);
      } else if (type === 'metal') {
        const g = ctx.createLinearGradient(px, sy - 10, px, sy + 2);
        g.addColorStop(0, hsl(c.h, c.s, Math.min(c.l + 25, 90)));
        g.addColorStop(1, hsl(c.h, c.s, c.l - 10));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(px, sy - 10);
        ctx.lineTo(px + 6, sy + 2);
        ctx.lineTo(px - 6, sy + 2);
        ctx.closePath();
        ctx.fill();
        // Highlight edge
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.moveTo(px, sy - 9);
        ctx.lineTo(px + 3, sy - 2);
        ctx.lineTo(px - 1, sy - 2);
        ctx.closePath();
        ctx.fill();
      } else {
        const g = ctx.createRadialGradient(px - 1, sy - 3, 0, px, sy - 2, 5);
        g.addColorStop(0, hsl(c.h, c.s, Math.min(c.l + 25, 90)));
        g.addColorStop(1, hsl(c.h, c.s, c.l - 10));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, sy - 2, 5, 0, Math.PI * 2);
        ctx.fill();
        // Specular dot
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(px - 1.5, sy - 3.5, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Ammo count text
    if (ammo > 0) {
      ctx.font = 'bold 14px Outfit, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      const textY = y - stackCount * (itemH + gap) - 8;
      ctx.strokeText(ammo.toString(), x, textY);
      ctx.fillText(ammo.toString(), x, textY);
    }

    ctx.restore();
  }

  function renderSnakeHead() {
    // Head orb
    draw3DOrb(headX, headY, HEAD_RADIUS, { h: 262, s: 60, l: 55 }, 0.4);

    // Eyes
    const eyeOffset = HEAD_RADIUS * 0.35;
    const eyeR = HEAD_RADIUS * 0.22;
    const perpAngle = headAngle + Math.PI / 2;

    for (const side of [-1, 1]) {
      const ex = headX + Math.cos(headAngle) * HEAD_RADIUS * 0.35 + Math.cos(perpAngle) * eyeOffset * side;
      const ey = headY + Math.sin(headAngle) * HEAD_RADIUS * 0.35 + Math.sin(perpAngle) * eyeOffset * side;

      // Eye white
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
      ctx.fill();

      // Pupil
      const px = ex + Math.cos(headAngle) * eyeR * 0.35;
      const py = ey + Math.sin(headAngle) * eyeR * 0.35;
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(px, py, eyeR * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ==========================================================
     SECTION 21: RENDERING — PROJECTILES
     ========================================================== */
  function renderProjectiles() {
    for (const p of projectiles) {
      ctx.save();

      if (p.type === 'default') {
        // White-purple circle with faint trail
        for (let t = 0; t < p.trail.length; t++) {
          const a = (t / p.trail.length) * 0.3;
          ctx.globalAlpha = a;
          ctx.fillStyle = hslObj(p.color);
          ctx.beginPath();
          ctx.arc(p.trail[t].x, p.trail[t].y, p.radius * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = hslObj(p.color);
        ctx.shadowColor = hslObj(p.color);
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Inner bright core
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.35, 0, Math.PI * 2);
        ctx.fill();

      } else if (p.type === 'fire') {
        // Orange with flame trail — more dramatic
        for (let t = 0; t < p.trail.length; t++) {
          const a = (t / p.trail.length) * 0.5;
          ctx.globalAlpha = a;
          const r = p.radius * (0.4 + (t / p.trail.length) * 0.7);
          ctx.fillStyle = hsl(27 + (p.trail.length - t) * 4, 96, 54);
          ctx.beginPath();
          ctx.arc(p.trail[t].x, p.trail[t].y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = hsl(27, 96, 54);
        ctx.shadowColor = 'rgba(255,140,0,0.9)';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Larger inner white-yellow core
        ctx.fillStyle = hsl(50, 100, 85);
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(255,255,150,0.8)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();

      } else if (p.type === 'metal') {
        // Grey elongated shape — wider and with metallic sheen
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = hsl(220, 8, 62);
        ctx.shadowColor = 'rgba(150,160,170,0.7)';
        ctx.shadowBlur = 8;
        ctx.fillRect(-p.radius * 2.5, -p.radius * 0.7, p.radius * 5, p.radius * 1.4);

        // Metallic sheen highlight
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(-p.radius * 2, -p.radius * 0.5, p.radius * 4, p.radius * 0.4);

        // Tip highlight
        ctx.fillStyle = 'rgba(200,210,220,0.5)';
        ctx.fillRect(p.radius * 1.5, -p.radius * 0.3, p.radius * 0.8, p.radius * 0.6);

      } else if (p.type === 'poison') {
        // Green circle with dripping trail — more dramatic
        for (let t = 0; t < p.trail.length; t++) {
          const a = (t / p.trail.length) * 0.35;
          ctx.globalAlpha = a;
          ctx.fillStyle = hsl(140, 70, 42);
          const dripY = p.trail[t].y + (p.trail.length - t) * 3;
          const dripR = p.radius * (0.3 + (t / p.trail.length) * 0.5);
          ctx.beginPath();
          ctx.arc(p.trail[t].x, dripY, dripR, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = hsl(140, 70, 42);
        ctx.shadowColor = 'rgba(40,200,80,0.8)';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Brighter core
        ctx.fillStyle = hsl(140, 60, 70);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  /* ==========================================================
     SECTION 22: RENDERING — PARTICLES & FLOATING TEXT
     ========================================================== */
  function renderParticles() {
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = hslObj(p.color);
      ctx.shadowColor = hslObj(p.color, 0.5);
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * p.alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function renderFloatingTexts() {
    for (const ft of floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = 'bold 13px Outfit, sans-serif';
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  /* ==========================================================
     SECTION 23: RENDERING — MINIMAP
     ========================================================== */
  function renderMinimap() {
    const mmW = 180, mmH = 120;
    const mmX = W - mmW - 15, mmY = H - mmH - 15;
    const scaleX = mmW / WORLD_W;
    const scaleY = mmH / WORLD_H;

    // Background
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = 'rgba(8,8,14,0.85)';
    drawRoundedRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4, 6);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(124,58,237,0.3)';
    ctx.lineWidth = 1;
    drawRoundedRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4, 6);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // World border
    ctx.strokeStyle = 'rgba(124,58,237,0.2)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(mmX, mmY, mmW, mmH);

    // Walls on minimap
    for (const wall of walls) {
      ctx.fillStyle = 'rgba(124,58,237,0.25)';
      ctx.fillRect(
        mmX + wall.x * scaleX,
        mmY + wall.y * scaleY,
        Math.max(1, wall.w * scaleX),
        Math.max(1, wall.h * scaleY)
      );
    }

    // Ammo zones
    const zones = [
      { cx: 400, cy: WORLD_H - 300, color: hsl(27, 96, 54) },
      { cx: WORLD_W / 2, cy: WORLD_H - 300, color: hsl(140, 70, 42) },
      { cx: WORLD_W - 400, cy: WORLD_H - 300, color: hsl(220, 8, 62) }
    ];
    for (const z of zones) {
      ctx.fillStyle = z.color;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(mmX + z.cx * scaleX, mmY + z.cy * scaleY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Boxes
    for (const b of boxes) {
      if (!b.alive) continue;
      ctx.fillStyle = 'rgba(255,200,50,0.8)';
      ctx.fillRect(mmX + b.x * scaleX - 1.5, mmY + b.y * scaleY - 1.5, 3, 3);
    }

    // Boss
    if (boss && boss.alive) {
      ctx.fillStyle = 'rgba(255,40,40,0.9)';
      ctx.beginPath();
      ctx.arc(mmX + boss.x * scaleX, mmY + boss.y * scaleY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Snake head
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(mmX + headX * scaleX, mmY + headY * scaleY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Body segments
    for (const seg of bodySegments) {
      const cfg = BODY_PART_TYPES[seg.part.type];
      ctx.fillStyle = hslObj(cfg.color, 0.6);
      ctx.beginPath();
      ctx.arc(mmX + seg.x * scaleX, mmY + seg.y * scaleY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Camera viewport
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(
      mmX + cameraX * scaleX,
      mmY + cameraY * scaleY,
      W * scaleX,
      H * scaleY
    );

    ctx.restore();
  }

  /* ==========================================================
     SECTION 24: RENDERING — CURSOR
     ========================================================== */
  function renderCursor() {
    const cx = mouseX, cy = mouseY;
    const size = 12;

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;

    // Crosshair lines
    ctx.beginPath();
    ctx.moveTo(cx - size, cy);
    ctx.lineTo(cx - 4, cy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + 4, cy);
    ctx.lineTo(cx + size, cy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx, cy - 4);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy + 4);
    ctx.lineTo(cx, cy + size);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = 'rgba(124,58,237,0.8)';
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /* ==========================================================
     SECTION 24B: RENDERING — JOYSTICK
     ========================================================== */
  function renderJoystick() {
    if (!joystickActive) return;

    // Base circle (where right-click started)
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(joystickOriginX, joystickOriginY, JOYSTICK_MAX_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // Inner zone
    ctx.fillStyle = 'rgba(124,58,237,0.08)';
    ctx.beginPath();
    ctx.arc(joystickOriginX, joystickOriginY, JOYSTICK_MAX_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Stick (clamped to max radius)
    const dx = joystickX - joystickOriginX;
    const dy = joystickY - joystickOriginY;
    const mag = Math.min(Math.hypot(dx, dy), JOYSTICK_MAX_RADIUS);
    const angle = Math.atan2(dy, dx);
    const stickX = joystickOriginX + Math.cos(angle) * mag;
    const stickY = joystickOriginY + Math.sin(angle) * mag;

    // Line from center to stick
    ctx.strokeStyle = 'rgba(124,58,237,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(joystickOriginX, joystickOriginY);
    ctx.lineTo(stickX, stickY);
    ctx.stroke();

    // Stick knob
    const stickGrad = ctx.createRadialGradient(stickX, stickY, 0, stickX, stickY, 18);
    stickGrad.addColorStop(0, 'rgba(124,58,237,0.7)');
    stickGrad.addColorStop(1, 'rgba(124,58,237,0.2)');
    ctx.fillStyle = stickGrad;
    ctx.beginPath();
    ctx.arc(stickX, stickY, 18, 0, Math.PI * 2);
    ctx.fill();

    // Knob border
    ctx.strokeStyle = 'rgba(124,58,237,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(stickX, stickY, 18, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(joystickOriginX, joystickOriginY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /* ==========================================================
     SECTION 25: HUD UPDATE
     ========================================================== */
  let prevScore = 0, prevParts = 0;

  function updateHUD() {
    if (scoreValueEl) {
      scoreValueEl.textContent = score;
      if (score !== prevScore) { bumped(scoreValueEl); prevScore = score; }
    }
    if (partsValueEl) {
      partsValueEl.textContent = bodyParts.length;
      if (bodyParts.length !== prevParts) { bumped(partsValueEl); prevParts = bodyParts.length; }
    }
    if (highScoreEl) {
      highScoreEl.textContent = Math.max(highScore, score);
    }

    // Boss HP bars (center bar + mini bar)
    if (boss) {
      const pct = Math.max(0, boss.hp / boss.maxHp * 100);
      if (bossHpBar) bossHpBar.classList.remove('hidden');
      if (bossHpFill) bossHpFill.style.width = pct + '%';
      if (bossHpMiniFill) bossHpMiniFill.style.width = pct + '%';
    }
  }

  /* ==========================================================
     SECTION 26: MENU BACKGROUND
     ========================================================== */
  function initMenuParticles() {
    menuParticles = [];
    for (let i = 0; i < 60; i++) {
      menuParticles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: randRange(-15, 15),
        vy: randRange(-15, 15),
        radius: randRange(1, 3),
        alpha: randRange(0.1, 0.4),
        hue: randRange(240, 280)
      });
    }
  }

  function updateMenuParticles(dt) {
    for (const p of menuParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
      p.alpha = 0.15 + Math.sin(gameTime + p.x * 0.01) * 0.1;
    }
  }

  function renderMenuBackground() {
    renderBackground();
    for (const p of menuParticles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = hsl(p.hue, 50, 60);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ==========================================================
     SECTION 27: GAME FLOW
     ========================================================== */

  function createWalls() {
    walls = [];

    // Alcove 1 - top-left area (U-shape opening right)
    const a1x = 600, a1y = 300;
    walls.push({ x: a1x, y: a1y, w: 200, h: 20 });           // top wall
    walls.push({ x: a1x, y: a1y, w: 20, h: 250 });           // left wall
    walls.push({ x: a1x, y: a1y + 230, w: 200, h: 20 });     // bottom wall

    // Alcove 2 - center area (U-shape opening left)
    const a2x = 1600, a2y = 500;
    walls.push({ x: a2x, y: a2y, w: 200, h: 20 });           // top wall
    walls.push({ x: a2x + 180, y: a2y, w: 20, h: 250 });     // right wall
    walls.push({ x: a2x, y: a2y + 230, w: 200, h: 20 });     // bottom wall

    // Alcove 3 - right area (U-shape opening down)
    const a3x = 2200, a3y = 700;
    walls.push({ x: a3x, y: a3y, w: 20, h: 200 });           // left wall
    walls.push({ x: a3x, y: a3y, w: 250, h: 20 });           // top wall
    walls.push({ x: a3x + 230, y: a3y, w: 20, h: 200 });     // right wall

    // Alcove 4 - bottom center (L-shape)
    const a4x = 1200, a4y = 1100;
    walls.push({ x: a4x, y: a4y, w: 20, h: 300 });           // left wall
    walls.push({ x: a4x, y: a4y + 280, w: 250, h: 20 });     // bottom wall

    // Alcove 5 - top right (U-shape opening down)
    const a5x = 1900, a5y = 200;
    walls.push({ x: a5x, y: a5y, w: 20, h: 200 });           // left wall
    walls.push({ x: a5x, y: a5y, w: 280, h: 20 });           // top wall
    walls.push({ x: a5x + 260, y: a5y, w: 20, h: 200 });     // right wall
  }

  function initGame() {
    headX = 200;
    headY = 200;
    headAngle = 0;
    trail = [{ x: headX, y: headY }];
    bodyParts = [];
    bodySegments = [];
    headShootTimer = 0;
    speed = BASE_SPEED;

    projectiles = [];
    droppedParts = [];
    particles = [];
    floatingTexts = [];
    screenShake = { x: 0, y: 0, intensity: 0, timer: 0 };

    score = 0;
    totalDmg = 0;
    prevScore = 0;
    prevParts = 0;

    // Reset timer
    gameTimer = GAME_TIME_LIMIT;

    // Reset perks
    dmgMult = { fire: 1, metal: 1, poison: 1 };
    perkActive = false;
    perkOptions = [];

    // Reset joystick
    joystickActive = false;
    joystickMagnitude = 0;

    cameraX = headX - W / 2;
    cameraY = headY - H / 2;

    createBoss();
    createWalls();
    createBoxes();
    createAmmoPickups();
    createAmmoRocks();
    createFrogs();

    state = 'playing';
    showOverlay(null);
  }

  function gameOver() {
    state = 'gameover';
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('snakeshooter-high', highScore);
    }

    if (finalScoreEl) finalScoreEl.textContent = score;
    if (finalPartsEl) finalPartsEl.textContent = bodyParts.length;
    if (finalDmgEl) finalDmgEl.textContent = totalDmg;

    showOverlay('gameover');
  }

  function gameVictory() {
    state = 'victory';
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('snakeshooter-high', highScore);
    }

    const victoryScoreEl = document.getElementById('victory-score');
    const victoryPartsEl = document.getElementById('victory-parts');
    const victoryDmgEl = document.getElementById('victory-damage');

    if (victoryScoreEl) victoryScoreEl.textContent = score;
    if (victoryPartsEl) victoryPartsEl.textContent = bodyParts.length;
    if (victoryDmgEl) victoryDmgEl.textContent = totalDmg;

    showOverlay('victory');
  }

  function showOverlay(which) {
    startScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    victoryScreen.classList.add('hidden');

    if (which === 'start') startScreen.classList.remove('hidden');
    else if (which === 'gameover') gameoverScreen.classList.remove('hidden');
    else if (which === 'pause') pauseScreen.classList.remove('hidden');
    else if (which === 'victory') victoryScreen.classList.remove('hidden');
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      showOverlay('pause');
    } else if (state === 'paused') {
      state = 'playing';
      showOverlay(null);
    }
  }

  /* ==========================================================
     SECTION 28: MAIN RENDER
     ========================================================== */
  function render() {
    ctx.clearRect(0, 0, W, H);

    if (state === 'menu') {
      renderMenuBackground();
      renderCursor();
      return;
    }

    // World-space background
    renderBackground();

    // Apply camera transform
    ctx.save();
    ctx.translate(-cameraX + screenShake.x, -cameraY + screenShake.y);

    // Render order: back to front
    renderGrid();
    renderWorldBorder();
    renderWalls();
    renderAmmoZones();
    renderAmmoPickups();
    renderAmmoRocks();
    renderBoxes();
    renderFrogs();
    renderDroppedParts();
    renderBoss();
    renderRangeCircles();
    renderSnakeBody();
    renderSnakeHead();
    renderProjectiles();
    renderParticles();
    renderFloatingTexts();

    ctx.restore();
    // End world-space

    // Screen-space UI
    renderBossIndicator();
    renderTimer();
    renderMinimap();
    renderJoystick();
    renderCursor();

    // Perk card overlay (on top of everything)
    renderPerkCards();
  }

  function renderBossIndicator() {
    if (!boss || !boss.alive) return;

    // Check if boss is on screen
    const bossScreenX = boss.x - cameraX;
    const bossScreenY = boss.y - cameraY;
    const margin = 60;

    if (bossScreenX > -margin && bossScreenX < W + margin &&
        bossScreenY > -margin && bossScreenY < H + margin) return;

    // Boss is off-screen — draw arrow at edge
    const cx = W / 2, cy = H / 2;
    const angle = Math.atan2(bossScreenY - cy, bossScreenX - cx);

    // Find intersection with screen edge
    const pad = 50;
    let ax, ay;
    const tanA = Math.tan(angle);
    // Try right/left edge
    if (Math.abs(Math.cos(angle)) > 0.01) {
      const edgeX = Math.cos(angle) > 0 ? W - pad : pad;
      const edgeY = cy + (edgeX - cx) * Math.tan(angle);
      if (edgeY >= pad && edgeY <= H - pad) {
        ax = edgeX; ay = edgeY;
      }
    }
    if (ax === undefined) {
      // Try top/bottom edge
      const edgeY = Math.sin(angle) > 0 ? H - pad : pad;
      const edgeX = cx + (edgeY - cy) / Math.tan(angle);
      ax = clamp(edgeX, pad, W - pad);
      ay = edgeY;
    }

    // Pulsing glow
    const pulse = 0.7 + Math.sin(gameTime * 4) * 0.3;

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle);

    // Glow
    ctx.shadowColor = 'rgba(255,40,40,0.8)';
    ctx.shadowBlur = 12 * pulse;

    // Arrow shape
    ctx.fillStyle = `rgba(255,50,50,${0.7 * pulse})`;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-8, -10);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255,100,100,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.rotate(-angle);

    // Boss HP % text next to arrow
    const pct = Math.max(0, Math.ceil(boss.hp / boss.maxHp * 100));
    ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(255,200,200,0.9)';
    ctx.textAlign = 'center';
    ctx.fillText(`BOSS ${pct}%`, 0, -18);

    ctx.restore();
  }

  /* ==========================================================
     SECTION 29: MAIN UPDATE
     ========================================================== */
  function update(dt) {
    if (state === 'menu') {
      updateMenuParticles(dt);
      gameTime += dt;
      return;
    }

    if (state !== 'playing') return;

    // If perk cards showing, pause game updates
    if (perkActive) return;

    gameTime += dt;

    // Timer countdown
    gameTimer -= dt;
    if (gameTimer <= 0) {
      gameTimer = 0;
      gameOver();
      return;
    }

    // Update world mouse position
    worldMouseX = mouseX + cameraX;
    worldMouseY = mouseY + cameraY;

    updateSnake(dt);
    updateShooting(dt);
    updateProjectiles(dt);
    updateDots(dt);
    updateBoxes(dt);
    updateDroppedParts(dt);
    updateAmmoPickups(dt);
    updateAmmoRocks(dt);
    updateFrogs(dt);
    updateBoss(dt);
    updateParticles(dt);
    updateFloatingTexts(dt);
    updateCamera(dt);
    checkSelfCollision();
    updateHUD();
  }

  /* ==========================================================
     SECTION 30: GAME LOOP
     ========================================================== */
  function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    update(dt);
    render();

    requestAnimationFrame(gameLoop);
  }

  /* ==========================================================
     SECTION 31: INPUT HANDLERS
     ========================================================== */

  // Prevent context menu on canvas
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Left-click down: start joystick or select perk
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      e.preventDefault();

      // Check perk card clicks first
      if (perkActive) {
        handlePerkClick(e.clientX, e.clientY);
        return;
      }

      joystickActive = true;
      joystickOriginX = e.clientX;
      joystickOriginY = e.clientY;
      joystickX = e.clientX;
      joystickY = e.clientY;
    }
  });

  // Mouse move: update joystick if active, always update cursor position
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (joystickActive) {
      joystickX = e.clientX;
      joystickY = e.clientY;
    }
  });

  // Left-click up: stop joystick (on window so it works even outside canvas)
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      joystickActive = false;
    }
  });

  canvas.addEventListener('click', (e) => {
    if (state === 'menu') {
      // Let the start button also handle this via its own listener
    }
  });

  // Start button
  if (startBtn) {
    startBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state === 'menu') initGame();
    });
  }

  // Start screen click anywhere
  if (startScreen) {
    startScreen.addEventListener('click', () => {
      if (state === 'menu') initGame();
    });
  }

  // Restart button
  if (restartBtn) {
    restartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state === 'gameover') initGame();
    });
  }

  // Game over screen click anywhere
  if (gameoverScreen) {
    gameoverScreen.addEventListener('click', () => {
      if (state === 'gameover') initGame();
    });
  }

  // Victory restart
  if (restartBtnV) {
    restartBtnV.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state === 'victory') initGame();
    });
  }

  // Victory screen click anywhere
  if (victoryScreen) {
    victoryScreen.addEventListener('click', () => {
      if (state === 'victory') initGame();
    });
  }

  // Keyboard
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (state === 'menu' || state === 'gameover' || state === 'victory') {
        initGame();
      }
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (state === 'playing' || state === 'paused') {
        togglePause();
      }
    }
  });

  // Touch support — joystick via touch (on document so HUD doesn't block)
  document.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    mouseX = touch.clientX;
    mouseY = touch.clientY;

    // Menu/gameover/victory — tap to start
    if (state === 'menu' || state === 'gameover' || state === 'victory') {
      initGame();
      return;
    }

    // Perk card selection
    if (perkActive) {
      handlePerkClick(touch.clientX, touch.clientY);
      return;
    }

    // Start joystick
    joystickActive = true;
    joystickOriginX = touch.clientX;
    joystickOriginY = touch.clientY;
    joystickX = touch.clientX;
    joystickY = touch.clientY;
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    mouseX = touch.clientX;
    mouseY = touch.clientY;

    if (joystickActive) {
      joystickX = touch.clientX;
      joystickY = touch.clientY;
    }
  }, { passive: false });

  document.addEventListener('touchend', (e) => {
    e.preventDefault();
    joystickActive = false;
  }, { passive: false });

  document.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    joystickActive = false;
  }, { passive: false });

  /* ==========================================================
     SECTION 32: INITIALIZATION
     ========================================================== */
  function boot() {
    resize();
    initMenuParticles();
    state = 'menu';
    showOverlay('start');

    if (highScoreEl) highScoreEl.textContent = highScore;

    // Set initial mouse to center
    mouseX = W / 2;
    mouseY = H / 2;

    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }

  boot();

})();
