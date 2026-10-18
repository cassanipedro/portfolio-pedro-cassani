// Motorcycle 3D Loader, Physics Engine, Loma Jump Launcher, Particles & Camera
window.BikeController = (function() {
  'use strict';

  var WB = window.WorldBuilder;
  var PD = window.PortfolioData;

  var BIKE = {
    maxSpeed: 30,
    accel: 21,
    jumpPower: 16,
    climb: 1.8,
    lean: 0.85,
    turboMult: 1.5,
    baseOffset: 0.06
  };

  var GRAVITY = 18;
  var RAMP_BASE_POWER = 11.5;
  var TRICK_SPIN_RATE = 6.8;
  var ROUTE_BOOST = 1.32;
  var STEER_SMOOTH = 6;
  var TURN_RATE = 2.15;
  var FRICTION = 6;
  var MAX_REV = -9;
  var BIKE_COLLIDE_R = 0.55;

  var physics = {
    x: 0, z: 0, y: 0,
    heading: 0, speed: 0, steer: 0,
    pitch: 0, roll: 0, turbo: 1,
    airborne: false, yVel: 0, airTime: 0,
    trickRotation: 0, driftAccum: 0,
    onRoute: false, wheelie: 0, wheelieAccum: 0,
    climbSlope: 0, skidTimer: 0
  };

  var SPAWN_X = 0, SPAWN_Z = PD.CIRCUIT_RADIUS, SPAWN_HEADING = Math.PI / 2;
  var bike = null;
  var dustTex = null;
  var dustPool = [];
  var dustCursor = 0;
  var skidPool = [];
  var skidCursor = 0;
  var fallLeaves = [];
  var speedLeaves = [];
  var speedLeafGroup = null;
  var onScoreCallback = function() {};

  function groundSurfaceHeight(x, z) {
    var p = WB.platformHeightAt(x, z);
    var h = WB.heightAt(x, z);
    return p !== null ? Math.max(p, h) : h;
  }

  function makeWheelPivot(model, wheelNode) {
    var wbox = new THREE.Box3().setFromObject(wheelNode);
    var center = wbox.getCenter(new THREE.Vector3());
    var pivot = new THREE.Group();
    pivot.position.copy(center);
    model.add(pivot);
    model.remove(wheelNode);
    pivot.add(wheelNode);
    wheelNode.position.copy(center).multiplyScalar(-1);
    return { pivot: pivot, center: center };
  }

  function initBike(scene, toonGrad) {
    var pts = WB.getRoutes()[0].points;
    var p0 = pts[0], p1 = pts[1];
    SPAWN_X = p0.x;
    SPAWN_Z = p0.z;
    SPAWN_HEADING = Math.atan2(p1.x - p0.x, p1.z - p0.z);

    bike = new THREE.Group();
    scene.add(bike);
    bike.userData.frontWheel = new THREE.Object3D();
    bike.userData.rearWheel = new THREE.Object3D();
    bike.userData.rearWheelLocalPos = new THREE.Vector3(0, BIKE.baseOffset, -1.1);
    bike.userData.ready = false;

    var loader = new THREE.GLTFLoader();
    loader.parse(window.b64ToArrayBuffer(window.BIKE_GLB_B64), '', function(gltf) {
      var model = gltf.scene;
      model.updateMatrixWorld(true);

      var box = new THREE.Box3().setFromObject(model);
      var size = box.getSize(new THREE.Vector3());
      var targetLength = 2.5;
      var scl = targetLength / Math.max(size.z, 0.001);

      var frontWheelNode = model.getObjectByName('test005_test025');
      var rearWheelNode = model.getObjectByName('test003_test025');
      var frontInfo = frontWheelNode ? makeWheelPivot(model, frontWheelNode) : null;
      var rearInfo = rearWheelNode ? makeWheelPivot(model, rearWheelNode) : null;

      var crossWhite = new THREE.Color(0xf0ece2);
      var crossAccent = new THREE.Color(0xff8a3d);
      var bodyPanelNames = ['test008_test041', 'test001_test017', 'test_test001'];
      var accentNames = ['test011_test046', 'test002_test010'];

      model.traverse(function(o) {
        if (o.isMesh) {
          o.castShadow = true;
          var oldColor = (o.material && o.material.color) ? o.material.color.clone() : new THREE.Color(0xffffff);
          if (bodyPanelNames.indexOf(o.name) !== -1) oldColor = crossWhite.clone();
          if (accentNames.indexOf(o.name) !== -1) oldColor = crossAccent.clone();
          o.material = new THREE.MeshToonMaterial({ color: oldColor, gradientMap: toonGrad });
        }
      });

      var wrapper = new THREE.Group();
      wrapper.scale.setScalar(scl);
      wrapper.position.set(
        -(box.min.x + box.max.x) / 2 * scl,
        -box.min.y * scl,
        -(box.min.z + box.max.z) / 2 * scl
      );
      wrapper.add(model);
      bike.add(wrapper);

      if (frontInfo) {
        bike.userData.frontWheel = frontInfo.pivot;
      }
      if (rearInfo) {
        bike.userData.rearWheel = rearInfo.pivot;
        bike.userData.rearWheelLocalPos = wrapper.position.clone().add(rearInfo.center.clone().multiplyScalar(scl));
      }

      var plateC = document.createElement('canvas');
      plateC.width = 64; plateC.height = 32;
      var pctx = plateC.getContext('2d');
      pctx.fillStyle = '#121212'; pctx.fillRect(0, 0, 64, 32);
      pctx.strokeStyle = '#ff8a3d'; pctx.lineWidth = 2.5; pctx.strokeRect(2, 2, 60, 28);
      pctx.fillStyle = '#ffd166';
      pctx.font = 'bold 15px monospace';
      pctx.textAlign = 'center'; pctx.textBaseline = 'middle';
      pctx.fillText('</DEV>', 32, 18);
      var plateTex = new THREE.CanvasTexture(plateC);
      plateTex.magFilter = THREE.NearestFilter;
      plateTex.minFilter = THREE.NearestFilter;
      var plateMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.34, 0.17),
        new THREE.MeshBasicMaterial({ map: plateTex, side: THREE.DoubleSide })
      );
      plateMesh.position.set(0, 0.78, -1.08);
      plateMesh.rotation.y = Math.PI;
      bike.add(plateMesh);

      bike.userData.ready = true;
    });

    placeInitial();
  }

  function initParticles(scene) {
    var s = 64;
    var cnv = document.createElement('canvas');
    cnv.width = cnv.height = s;
    var ctx = cnv.getContext('2d');
    var grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
    dustTex = new THREE.CanvasTexture(cnv);

    var dustGroup = new THREE.Group();
    for (var di = 0; di < 30; di++) {
      var dmat = new THREE.SpriteMaterial({ map: dustTex, color: 0xcbb08a, transparent: true, opacity: 0, depthWrite: false });
      var dspr = new THREE.Sprite(dmat);
      dspr.scale.set(0.1, 0.1, 1);
      dspr.userData.life = 0;
      dustGroup.add(dspr);
      dustPool.push(dspr);
    }
    scene.add(dustGroup);

    var skC = document.createElement('canvas');
    skC.width = 16; skC.height = 16;
    var skCtx = skC.getContext('2d');
    var skGrad = skCtx.createLinearGradient(0, 0, 16, 0);
    skGrad.addColorStop(0, 'rgba(20,16,12,0)');
    skGrad.addColorStop(0.5, 'rgba(20,16,12,0.7)');
    skGrad.addColorStop(1, 'rgba(20,16,12,0)');
    skCtx.fillStyle = skGrad;
    skCtx.fillRect(0, 0, 16, 16);
    var skidTex = new THREE.CanvasTexture(skC);

    var skidGroup = new THREE.Group();
    for (var sk = 0; sk < 80; sk++) {
      var smat = new THREE.MeshBasicMaterial({ map: skidTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      var smesh = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.95), smat);
      smesh.rotation.order = 'YXZ';
      smesh.renderOrder = 1;
      skidGroup.add(smesh);
      skidPool.push({ mesh: smesh, life: 0, maxLife: 9 });
    }
    scene.add(skidGroup);

    function makeLeafTexture(colorHex) {
      var ls = 12;
      var lc = document.createElement('canvas');
      lc.width = ls; lc.height = ls;
      var lctx = lc.getContext('2d');
      lctx.imageSmoothingEnabled = false;
      lctx.fillStyle = colorHex;
      lctx.beginPath();
      lctx.moveTo(ls / 2, 0);
      lctx.quadraticCurveTo(ls, ls / 2, ls / 2, ls);
      lctx.quadraticCurveTo(0, ls / 2, ls / 2, 0);
      lctx.fill();
      var ltex = new THREE.CanvasTexture(lc);
      ltex.magFilter = THREE.NearestFilter;
      ltex.minFilter = THREE.NearestFilter;
      ltex.generateMipmaps = false;
      return ltex;
    }

    var leafTexes = [makeLeafTexture('#6f9b3f'), makeLeafTexture('#c98a33'), makeLeafTexture('#d2572f')];
    var fallLeafGroup = new THREE.Group();
    var treePoints = WB.getTreeSpawnPoints();

    function resetFallLeaf(it) {
      if (treePoints.length === 0) { it.spr.position.set(0, -50, 0); return; }
      var p = treePoints[Math.floor(Math.random() * treePoints.length)];
      it.spr.position.set(p.x + (Math.random() - 0.5) * 1.6, p.y + Math.random() * 0.7, p.z + (Math.random() - 0.5) * 1.6);
    }

    for (var li = 0; li < 34; li++) {
      var lmat = new THREE.SpriteMaterial({ map: leafTexes[li % 3], transparent: true, depthWrite: false });
      var lspr = new THREE.Sprite(lmat);
      lspr.scale.set(0.24, 0.24, 1);
      fallLeafGroup.add(lspr);
      var litem = { spr: lspr, vy: 0.45 + Math.random() * 0.4, seed: Math.random() * 100, reset: resetFallLeaf };
      resetFallLeaf(litem);
      litem.spr.position.y -= Math.random() * 4;
      fallLeaves.push(litem);
    }
    scene.add(fallLeafGroup);

    speedLeafGroup = new THREE.Group();
    for (var sl = 0; sl < 24; sl++) {
      var slmat = new THREE.SpriteMaterial({ map: leafTexes[sl % 3], transparent: true, opacity: 0, depthWrite: false });
      var sspr = new THREE.Sprite(slmat);
      sspr.scale.set(0.18, 0.18, 1);
      speedLeafGroup.add(sspr);
      speedLeaves.push({ spr: sspr, spin: (Math.random() - 0.5) * 5 });
    }
    scene.add(speedLeafGroup);
    speedLeafGroup.visible = false;
  }

  function spawnDust(pos, strength) {
    if (!dustPool.length) return;
    var spr = dustPool[dustCursor];
    dustCursor = (dustCursor + 1) % dustPool.length;
    spr.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.05, (Math.random() - 0.5) * 0.4));
    spr.userData.life = 0.55;
    spr.userData.maxLife = 0.55;
    spr.userData.vy = 0.6 + Math.random() * 0.4;
    spr.scale.set(0.15, 0.15, 1);
    spr.material.opacity = 0.55 * strength;
  }

  function spawnSkidSegment(pos, heading) {
    if (!skidPool.length) return;
    var it = skidPool[skidCursor];
    skidCursor = (skidCursor + 1) % skidPool.length;
    it.mesh.position.set(pos.x, pos.y + 0.03, pos.z);
    it.mesh.rotation.set(-Math.PI / 2, heading, 0);
    it.mesh.material.opacity = 0.7;
    it.life = it.maxLife;
  }

  function checkRamps() {
    if (physics.airborne) return;
    var ramps = WB.getRamps();
    for (var i = 0; i < ramps.length; i++) {
      var rp = ramps[i];
      var dx = physics.x - rp.pos.x, dz = physics.z - rp.pos.z;
      if (Math.hypot(dx, dz) < 3.4) {
        var bfx = Math.sin(physics.heading), bfz = Math.cos(physics.heading);
        var rfx = Math.sin(rp.heading), rfz = Math.cos(rp.heading);
        if (bfx * rfx + bfz * rfz > 0.3 && Math.abs(physics.speed) > 6.5) {
          physics.airborne = true;
          physics.yVel = RAMP_BASE_POWER * (BIKE.jumpPower / 10) * rp.power;
          physics.airTime = 0;
          physics.trickRotation = 0;
          physics.climbSlope = 0;
          physics.speed = Math.min(physics.speed * 1.08, BIKE.maxSpeed * 1.35);
          spawnDust(bike.position, 1);
          return;
        }
      }
    }
  }

  // Launch motorcycle into the air when crossing the crest of the steep road lomas
  function checkHillLaunch(dt) {
    if (physics.airborne) return;
    var spd = Math.abs(physics.speed);
    var dir = physics.speed >= 0 ? 1 : -1;
    var mfx = Math.sin(physics.heading) * dir, mfz = Math.cos(physics.heading) * dir;

    var hBack = groundSurfaceHeight(physics.x - mfx * 1.4, physics.z - mfz * 1.4);
    var hNow  = groundSurfaceHeight(physics.x, physics.z);
    var hFwd  = groundSurfaceHeight(physics.x + mfx * 1.4, physics.z + mfz * 1.4);
    var hFar  = groundSurfaceHeight(physics.x + mfx * 3.0, physics.z + mfz * 3.0);

    var slopeBehind = (hNow - hBack) / 1.4;
    var slopeAhead  = (hFwd - hNow) / 1.4;
    var slopeFar    = (hFar - hNow) / 3.0;

    if (slopeBehind > physics.climbSlope) {
      physics.climbSlope += (slopeBehind - physics.climbSlope) * Math.min(1, 18 * dt);
    } else {
      physics.climbSlope *= Math.max(0, 1 - 2.2 * dt);
    }

    if (spd > 5.0 && physics.climbSlope > 0.20 && slopeAhead < 0.24 && (physics.climbSlope - slopeFar) > 0.22) {
      physics.airborne = true;
      var effSlope = Math.max(physics.climbSlope, slopeBehind, 0.52);
      physics.yVel = Math.max(10.5, Math.min(21.5, spd * effSlope * 0.62 + 6.2));
      physics.airTime = 0;
      physics.trickRotation = 0;
      physics.climbSlope = 0;
      physics.speed = Math.min(physics.speed * 1.06, BIKE.maxSpeed * 1.4);
      spawnDust(bike.position, 1);
    }
  }

  function landTrick() {
    var fullRots = Math.floor(Math.abs(physics.trickRotation) / (Math.PI * 2) + 0.14);
    if (fullRots >= 1) {
      onScoreCallback(fullRots * 250, fullRots > 1 ? '¡Doble mortal!' : '¡Mortal!');
    } else if (physics.airTime > 0.35) {
      onScoreCallback(Math.round(physics.airTime * 75), '¡Gran Salto!');
    }
    physics.trickRotation = 0;
    physics.airTime = 0;
    spawnDust(bike.position, 1);
  }

  function resolveCollisions() {
    if (physics.airborne) return;
    var obstacles = WB.getObstacles();
    for (var i = 0; i < obstacles.length; i++) {
      var o = obstacles[i];
      var dx = physics.x - o.x, dz = physics.z - o.z;
      var distSq = dx * dx + dz * dz;
      var minD = o.r + BIKE_COLLIDE_R;
      if (distSq < minD * minD) {
        var dist = Math.sqrt(distSq) || 0.001;
        var push = minD - dist;
        physics.x += (dx / dist) * push;
        physics.z += (dz / dist) * push;
        physics.speed *= 0.3;
        if (Math.abs(physics.speed) > 4) spawnDust(bike.position, 0.7);
      }
    }
  }

  function updatePhysics(dt, input) {
    var B = BIKE;
    var steerTarget = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    physics.steer += (steerTarget - physics.steer) * Math.min(1, STEER_SMOOTH * dt);

    var wheelieInput = (input.forward && input.back) || input.trick;

    if (physics.airborne) {
      if (wheelieInput) physics.trickRotation += TRICK_SPIN_RATE * dt;
      physics.x += Math.sin(physics.heading) * physics.speed * dt;
      physics.z += Math.cos(physics.heading) * physics.speed * dt;
      var rAir = Math.hypot(physics.x, physics.z);
      if (rAir > PD.WORLD_R - 2) {
        var kk = (PD.WORLD_R - 2) / rAir;
        physics.x *= kk; physics.z *= kk;
      }
      physics.onRoute = false;
      physics.wheelie = Math.max(0, physics.wheelie - dt * 2.5);
      return;
    }

    var throttle = (input.forward && input.back) ? 1 : (input.forward ? 1 : (input.back ? -1 : 0));
    var onRoute = WB.isOnRoute(physics.x, physics.z);
    physics.onRoute = onRoute;

    var turboActive = false;
    if (input.turbo && physics.turbo > 0.05 && throttle > 0) {
      turboActive = true;
      physics.turbo = Math.max(0, physics.turbo - 0.55 * dt);
    } else {
      physics.turbo = Math.min(1, physics.turbo + 0.28 * dt);
    }
    var maxSpeed = B.maxSpeed * (turboActive ? B.turboMult : 1) * (onRoute ? ROUTE_BOOST : 1);

    var s = WB.slopeAt(physics.x, physics.z);
    var fx = Math.sin(physics.heading), fz = Math.cos(physics.heading);
    var slopeAlong = s.dx * fx + s.dz * fz;
    var slopeFactor = THREE.MathUtils.clamp(1 - (slopeAlong * 0.24) / B.climb, 0.75, 1.5);

    if (throttle > 0) {
      physics.speed += B.accel * slopeFactor * (turboActive ? 1.4 : 1) * (onRoute ? 1.25 : 1) * dt;
    } else if (throttle < 0) {
      if (physics.speed > 0.3) physics.speed -= 32 * dt;
      else physics.speed -= B.accel * 0.6 * dt;
    } else {
      var fr = FRICTION * (1 + Math.max(0, -slopeAlong) * 0.5);
      if (physics.speed > 0) physics.speed = Math.max(0, physics.speed - fr * dt);
      else physics.speed = Math.min(0, physics.speed + fr * dt);
    }
    physics.speed += -slopeAlong * (throttle > 0 ? 1.2 : 5.0) * dt;
    physics.speed = THREE.MathUtils.clamp(physics.speed, MAX_REV, maxSpeed);

    var speedRatio = THREE.MathUtils.clamp(Math.abs(physics.speed) / 8, 0, 1);
    physics.heading += physics.steer * TURN_RATE * speedRatio * dt * (physics.speed < 0 ? -1 : 1);

    physics.x += Math.sin(physics.heading) * physics.speed * dt;
    physics.z += Math.cos(physics.heading) * physics.speed * dt;

    var r = Math.hypot(physics.x, physics.z);
    if (r > PD.WORLD_R - 2) {
      var k = (PD.WORLD_R - 2) / r;
      physics.x *= k; physics.z *= k;
      physics.speed *= 0.5;
    }

    resolveCollisions();

    if (Math.abs(physics.steer) > 0.6 && Math.abs(physics.speed) > 9) {
      physics.driftAccum += dt;
      if (physics.driftAccum >= 0.5) {
        onScoreCallback(25, '¡Derrape!');
        physics.driftAccum -= 0.5;
      }
      physics.skidTimer = (physics.skidTimer || 0) + dt;
      if (physics.skidTimer >= 0.07) {
        physics.skidTimer = 0;
        var rw = bike.userData.rearWheelLocalPos.clone().applyMatrix4(bike.matrixWorld);
        spawnSkidSegment(rw, physics.heading);
      }
    } else {
      physics.driftAccum = Math.max(0, physics.driftAccum - dt * 2);
      physics.skidTimer = 0;
    }

    if (wheelieInput && Math.abs(physics.speed) > 2) {
      physics.wheelie = Math.min(1, physics.wheelie + dt * 1.8);
    } else {
      physics.wheelie = Math.max(0, physics.wheelie - dt * 2.2);
    }
    if (physics.wheelie > 0.72) {
      physics.wheelieAccum += dt;
      if (physics.wheelieAccum >= 0.5) {
        onScoreCallback(20, '¡Willy!');
        physics.wheelieAccum -= 0.5;
      }
    } else {
      physics.wheelieAccum = Math.max(0, physics.wheelieAccum - dt * 2);
    }

    checkRamps();
    checkHillLaunch(dt);
  }

  function updateBikeMesh(dt) {
    var B = BIKE;
    if (physics.airborne) {
      physics.yVel -= GRAVITY * dt;
      physics.y += physics.yVel * dt;
      physics.airTime += dt;
      var g = groundSurfaceHeight(physics.x, physics.z) + B.baseOffset;
      if (physics.y <= g && physics.yVel < 0) {
        physics.airborne = false;
        physics.y = g;
        landTrick();
      } else if (physics.y < g) {
        physics.y = g;
      }
      physics.pitch += (THREE.MathUtils.clamp(-physics.yVel * 0.03, -0.45, 0.45) - physics.pitch) * Math.min(1, 4 * dt);
    } else {
      var fS = WB.slopeAt(physics.x + Math.sin(physics.heading) * 0.95, physics.z + Math.cos(physics.heading) * 0.95);
      var rS = WB.slopeAt(physics.x - Math.sin(physics.heading) * 0.75, physics.z - Math.cos(physics.heading) * 0.75);
      var groundH = groundSurfaceHeight(physics.x, physics.z);
      var targetY = groundH + B.baseOffset;
      physics.y += (targetY - physics.y) * Math.min(1, 20 * dt);
      var targetPitch = THREE.MathUtils.clamp(Math.atan2(rS.h - fS.h, 1.7), -0.75, 0.75) - physics.wheelie * 0.52;
      physics.pitch += (targetPitch - physics.pitch) * Math.min(1, 12 * dt);
    }

    bike.position.set(physics.x, physics.y, physics.z);

    var targetRoll = physics.airborne
      ? physics.roll * 0.9
      : (-physics.steer * 0.4 * B.lean * THREE.MathUtils.clamp(Math.abs(physics.speed) / 14, 0, 1));
    physics.roll += (targetRoll - physics.roll) * Math.min(1, 6 * dt);

    var visualPitch = physics.airborne ? (physics.pitch + physics.trickRotation) : physics.pitch;
    bike.rotation.order = 'YXZ';
    bike.rotation.set(visualPitch, physics.heading, physics.roll);

    var wheelSpin = physics.speed * dt / 0.38;
    bike.userData.frontWheel.rotation.x -= wheelSpin;
    bike.userData.rearWheel.rotation.x -= wheelSpin;

    if (!physics.airborne && Math.abs(physics.speed) > 3 && Math.random() < 0.6) {
      var rearWorld = bike.userData.rearWheelLocalPos.clone().applyMatrix4(bike.matrixWorld);
      spawnDust(rearWorld, Math.min(1, Math.abs(physics.speed) / 20) + (Math.abs(physics.steer) > 0.5 ? 0.4 : 0));
    }
  }

  function updateParticles(dt) {
    for (var i = 0; i < dustPool.length; i++) {
      var spr = dustPool[i];
      if (spr.userData.life > 0) {
        spr.userData.life -= dt;
        var t = 1 - spr.userData.life / spr.userData.maxLife;
        spr.position.y += spr.userData.vy * dt;
        var sc = 0.15 + t * 0.9;
        spr.scale.set(sc, sc, 1);
        spr.material.opacity = Math.max(0, 0.5 * (1 - t));
      }
    }

    for (var j = 0; j < skidPool.length; j++) {
      var sk = skidPool[j];
      if (sk.life > 0) {
        sk.life -= dt;
        sk.mesh.material.opacity = Math.max(0, 0.7 * Math.min(1, sk.life / 1.5));
      }
    }

    var now = performance.now();
    for (var k = 0; k < fallLeaves.length; k++) {
      var fl = fallLeaves[k];
      fl.spr.position.y -= fl.vy * dt;
      fl.spr.position.x += Math.sin(now * 0.0006 + fl.seed) * 0.3 * dt;
      fl.spr.position.z += Math.cos(now * 0.0005 + fl.seed) * 0.3 * dt;
      fl.spr.material.rotation = Math.sin(now * 0.002 + fl.seed) * 0.6;
      var gh = WB.heightAt(fl.spr.position.x, fl.spr.position.z);
      if (fl.spr.position.y < gh + 0.05) {
        fl.reset(fl);
      }
    }

    var sp = Math.abs(physics.speed);
    var active = !physics.airborne && sp > 9;
    if (speedLeafGroup) {
      speedLeafGroup.visible = active;
      if (active) {
        var fx = Math.sin(physics.heading), fz = Math.cos(physics.heading);
        var rx = fz, rz = -fx;
        for (var m = 0; m < speedLeaves.length; m++) {
          var sl = speedLeaves[m];
          sl.spr.material.opacity = Math.min(0.85, (sp - 9) / 14);
          sl.spr.position.x -= fx * sp * 1.4 * dt;
          sl.spr.position.z -= fz * sp * 1.4 * dt;
          sl.spr.material.rotation += sl.spin * dt;
          var dx = sl.spr.position.x - bike.position.x, dz = sl.spr.position.z - bike.position.z;
          var behind = dx * fx + dz * fz;
          if (behind < -4 || Math.hypot(dx, dz) > 9) {
            var fwdDist = 2 + Math.random() * 6;
            var lat = (Math.random() - 0.5) * 7;
            sl.spr.position.set(
              bike.position.x + fx * fwdDist + rx * lat,
              bike.position.y + 0.25 + Math.random() * 2.2,
              bike.position.z + fz * fwdDist + rz * lat
            );
          }
        }
      }
    }
  }

  function placeInitial() {
    physics.x = SPAWN_X;
    physics.z = SPAWN_Z;
    physics.heading = SPAWN_HEADING;
    var h = WB.heightAt(physics.x, physics.z);
    physics.y = h + BIKE.baseOffset;
    var fS = WB.slopeAt(physics.x + Math.sin(physics.heading) * 0.95, physics.z + Math.cos(physics.heading) * 0.95);
    var rS = WB.slopeAt(physics.x - Math.sin(physics.heading) * 0.75, physics.z - Math.cos(physics.heading) * 0.75);
    physics.pitch = THREE.MathUtils.clamp(Math.atan2(rS.h - fS.h, 1.7), -0.65, 0.65);
    if (bike) {
      bike.position.set(physics.x, physics.y, physics.z);
      bike.rotation.order = 'YXZ';
      bike.rotation.set(physics.pitch, physics.heading, 0);
    }
  }

  function resetPhysics() {
    physics.speed = 0; physics.steer = 0; physics.pitch = 0; physics.roll = 0; physics.turbo = 1;
    physics.airborne = false; physics.yVel = 0; physics.airTime = 0; physics.trickRotation = 0;
    physics.driftAccum = 0; physics.wheelie = 0; physics.wheelieAccum = 0; physics.climbSlope = 0;
    placeInitial();
  }

  return {
    BIKE: BIKE,
    physics: physics,
    initBike: initBike,
    initParticles: initParticles,
    updatePhysics: updatePhysics,
    updateBikeMesh: updateBikeMesh,
    updateParticles: updateParticles,
    placeInitial: placeInitial,
    resetPhysics: resetPhysics,
    getBike: function() { return bike; },
    getDustTex: function() { return dustTex; },
    setScoreCallback: function(cb) { onScoreCallback = cb; }
  };
})();
