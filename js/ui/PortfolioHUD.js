// Main Application & React-style UI State Controller (Scene, Weather, HUD, Multi-Touch Mobile Controls)
(function() {
  'use strict';

  var PD = window.PortfolioData;
  var WB = window.WorldBuilder;
  var BC = window.BikeController;

  var canvas = document.getElementById('scene');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xe79a63, 0.0055);

  var camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
  var PIXEL_SCALE = 0.4;

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(1);
    renderer.setSize(Math.max(2, Math.round(w * PIXEL_SCALE)), Math.max(2, Math.round(h * PIXEL_SCALE)), false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // Toon shading gradient
  function makeToonGradient() {
    var c = document.createElement('canvas');
    c.width = 6; c.height = 1;
    var ctx = c.getContext('2d');
    var shades = ['#1c1c1c', '#4a4a4a', '#7c7c7c', '#a8a8a8', '#cfcfcf', '#ffffff'];
    for (var i = 0; i < shades.length; i++) {
      ctx.fillStyle = shades[i];
      ctx.fillRect(i, 0, 1, 1);
    }
    var tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return tex;
  }
  var toonGrad = makeToonGradient();
  function toonMat(color, extra) {
    var o = Object.assign({ color: color, gradientMap: toonGrad }, extra || {});
    return new THREE.MeshToonMaterial(o);
  }

  // Lights
  var hemi = new THREE.HemisphereLight(0xffe3b0, 0x4f6a3f, 0.68);
  scene.add(hemi);
  var sun = new THREE.DirectionalLight(0xffdca8, 1.65);
  sun.position.set(60, 90, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 220;
  sun.shadow.camera.left = -42;
  sun.shadow.camera.right = 42;
  sun.shadow.camera.top = 42;
  sun.shadow.camera.bottom = -42;
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0012;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  // Sky dome
  (function buildSky() {
    var skyGeo = new THREE.SphereGeometry(400, 24, 16);
    var pos = skyGeo.attributes.position;
    var top = new THREE.Color(0x4a74ac);
    var horizon = new THREE.Color(0xf6c088);
    var skyColors = [];
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i) / 400;
      var t = THREE.MathUtils.clamp(y * 1.1 + 0.15, 0, 1);
      var c = horizon.clone().lerp(top, t);
      skyColors.push(c.r, c.g, c.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
    var skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
    scene.add(new THREE.Mesh(skyGeo, skyMat));
  })();

  // Build World, Road, Stations, Trick Park, Foliage & Motorcycle
  WB.buildTerrain(scene, toonGrad);
  WB.buildStations(scene, toonGrad, toonMat);
  WB.buildCircuitRoad(scene, toonGrad, 0xffd166);
  WB.buildTrickPark(scene, toonMat);
  WB.buildTreesAndRocks(scene, toonMat);
  BC.initBike(scene, toonGrad);
  BC.initParticles(scene);

  // Weather system
  var WEATHER = ['sun', 'rain', 'snow'];
  var WEATHER_ICON = { sun: '☀', rain: '🌧', snow: '❄' };
  var weatherParams = {
    sun:  { fog: 0xe79a63, fogDensity: 0.0055, hemiSky: 0xffe3b0, hemiGround: 0x4f6a3f, hemiI: 0.95, sunColor: 0xffdca8, sunI: 1.4, precip: 'none' },
    rain: { fog: 0x5c6670, fogDensity: 0.01,   hemiSky: 0x9fb0c0, hemiGround: 0x33363c, hemiI: 0.55, sunColor: 0xcfd8e0, sunI: 0.55, precip: 'rain' },
    snow: { fog: 0xd9e4ec, fogDensity: 0.008,  hemiSky: 0xe8f0f5, hemiGround: 0x8a93a0, hemiI: 0.8,  sunColor: 0xf0f5fa, sunI: 1.0, precip: 'snow' }
  };
  var weatherIdx = 0, weatherTimer = 0, WEATHER_CYCLE = 55, WEATHER_TRANSITION = 4, transT = 1;
  var fromParams = weatherParams.sun, toParams = weatherParams.sun;
  var currentPrecip = 'none';
  var weatherPillEl = document.getElementById('weather-pill');

  var PRECIP_COUNT = 55;
  var precipItems = [];
  var precipGroup = new THREE.Group();
  for (var pi = 0; pi < PRECIP_COUNT; pi++) {
    var pmat = new THREE.SpriteMaterial({ map: BC.getDustTex(), transparent: true, opacity: 0, depthWrite: false });
    var pspr = new THREE.Sprite(pmat);
    precipGroup.add(pspr);
    precipItems.push({ spr: pspr, seed: Math.random() * 100 });
  }
  scene.add(precipGroup);
  precipGroup.visible = false;

  function resetPrecipItem(it) {
    var R = 20;
    var bike = BC.getBike();
    var fx = Math.sin(BC.physics.heading), fz = Math.cos(BC.physics.heading);
    var rx = fz, rz = -fx;
    var fwdDist = 4 + Math.random() * R;
    var lat = (Math.random() - 0.5) * R * 1.4;
    it.spr.position.set(
      bike.position.x + fx * fwdDist + rx * lat,
      bike.position.y + 3 + Math.random() * 9,
      bike.position.z + fz * fwdDist + rz * lat
    );
  }

  function reconfigurePrecip() {
    if (currentPrecip === 'none') { precipGroup.visible = false; return; }
    precipGroup.visible = true;
    var isRain = currentPrecip === 'rain';
    precipItems.forEach(function(it) {
      it.spr.material.opacity = isRain ? 0.85 : 0.95;
      it.spr.material.color.set(isRain ? 0x7e92a8 : 0xffffff);
      it.spr.scale.set(isRain ? 0.12 : 0.24, isRain ? 0.75 : 0.24, 1);
      resetPrecipItem(it);
    });
  }

  function updatePrecip(dt) {
    if (currentPrecip === 'none') return;
    var isRain = currentPrecip === 'rain';
    var fall = isRain ? 26 : 2.6;
    var bike = BC.getBike();
    for (var i = 0; i < precipItems.length; i++) {
      var it = precipItems[i];
      it.spr.position.y -= fall * dt;
      if (!isRain) {
        it.spr.position.x += Math.sin(performance.now() * 0.0005 + it.seed) * 0.4 * dt;
        it.spr.position.z += Math.cos(performance.now() * 0.0004 + it.seed) * 0.4 * dt;
      }
      if (it.spr.position.y < bike.position.y - 2) {
        resetPrecipItem(it);
      }
    }
  }

  function advanceWeather(dt) {
    weatherTimer += dt;
    if (transT < 1) {
      transT = Math.min(1, transT + dt / WEATHER_TRANSITION);
      var fogA = new THREE.Color(fromParams.fog), fogB = new THREE.Color(toParams.fog);
      scene.fog.color.copy(fogA).lerp(fogB, transT);
      scene.fog.density = THREE.MathUtils.lerp(fromParams.fogDensity, toParams.fogDensity, transT);
      hemi.color.copy(new THREE.Color(fromParams.hemiSky)).lerp(new THREE.Color(toParams.hemiSky), transT);
      hemi.groundColor.copy(new THREE.Color(fromParams.hemiGround)).lerp(new THREE.Color(toParams.hemiGround), transT);
      hemi.intensity = THREE.MathUtils.lerp(fromParams.hemiI, toParams.hemiI, transT);
      sun.color.copy(new THREE.Color(fromParams.sunColor)).lerp(new THREE.Color(toParams.sunColor), transT);
      sun.intensity = THREE.MathUtils.lerp(fromParams.sunI, toParams.sunI, transT);
    }
    if (transT >= 1 && currentPrecip !== toParams.precip) {
      currentPrecip = toParams.precip;
      reconfigurePrecip();
    }
    if (weatherTimer > WEATHER_CYCLE) {
      weatherTimer = 0;
      weatherIdx = (weatherIdx + 1) % WEATHER.length;
      fromParams = toParams;
      toParams = weatherParams[WEATHER[weatherIdx]];
      transT = 0;
      weatherPillEl.textContent = WEATHER_ICON[WEATHER[weatherIdx]];
    }
  }

  // Input & Ergonomic Multi-Touch Mobile Controls
  var keys = {};
  window.addEventListener('keydown', function(e) {
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) !== -1) e.preventDefault();
  });
  window.addEventListener('keyup', function(e) { keys[e.code] = false; });
  function isDown() {
    for (var i = 0; i < arguments.length; i++) {
      if (keys[arguments[i]]) return true;
    }
    return false;
  }

  var touchState = { forward: false, back: false, left: false, right: false, turbo: false, trick: false };
  (function bindTouchControls() {
    var map = {
      'forward': 'forward',
      'back': 'back',
      'turn-left': 'left',
      'turn-right': 'right',
      'turbo': 'turbo',
      'trick': 'trick'
    };
    document.querySelectorAll('.tc-btn').forEach(function(btn) {
      var key = map[btn.dataset.key];
      if (!key) return;
      var on = function(e) {
        e.preventDefault();
        e.stopPropagation();
        touchState[key] = true;
        btn.classList.add('active');
      };
      var off = function(e) {
        e.preventDefault();
        e.stopPropagation();
        touchState[key] = false;
        btn.classList.remove('active');
      };
      btn.addEventListener('touchstart', on, { passive: false });
      btn.addEventListener('touchend', off, { passive: false });
      btn.addEventListener('touchcancel', off, { passive: false });
      btn.addEventListener('mousedown', on);
      btn.addEventListener('mouseup', off);
      btn.addEventListener('mouseleave', off);
    });
  })();

  function updateTouchControlsVisibility() {
    var isTouch = window.matchMedia('(pointer:coarse)').matches || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.innerWidth <= 820;
    document.getElementById('touch-controls').hidden = !isTouch;
  }
  updateTouchControlsVisibility();
  window.addEventListener('resize', updateTouchControlsVisibility);

  function getInput() {
    return {
      forward: isDown('KeyW', 'ArrowUp') || touchState.forward,
      back: isDown('KeyS', 'ArrowDown') || touchState.back,
      left: isDown('KeyA', 'ArrowLeft') || touchState.left,
      right: isDown('KeyD', 'ArrowRight') || touchState.right,
      turbo: isDown('ShiftLeft', 'ShiftRight') || touchState.turbo,
      trick: isDown('Space') || touchState.trick
    };
  }

  // Camera drag / orbit
  var camOrbit = { yaw: 0, pitch: 0, idleTimer: 0 };
  var BASE_PITCH = 0.42;
  var isDragging = false, dragLastX = 0, dragLastY = 0;
  function dragStart(x, y) { isDragging = true; dragLastX = x; dragLastY = y; camOrbit.idleTimer = 0; }
  function dragMove(x, y) {
    if (!isDragging) return;
    var dx = x - dragLastX, dy = y - dragLastY;
    dragLastX = x; dragLastY = y;
    camOrbit.yaw -= dx * 0.007;
    camOrbit.pitch = THREE.MathUtils.clamp(camOrbit.pitch - dy * 0.005, -0.32, 0.55);
    camOrbit.idleTimer = 0;
  }
  function dragEnd() { isDragging = false; }
  canvas.addEventListener('mousedown', function(e) { dragStart(e.clientX, e.clientY); });
  window.addEventListener('mousemove', function(e) { dragMove(e.clientX, e.clientY); });
  window.addEventListener('mouseup', dragEnd);
  canvas.addEventListener('touchstart', function(e) {
    if (e.touches.length === 1) dragStart(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  canvas.addEventListener('touchmove', function(e) {
    if (e.touches.length === 1) dragMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  canvas.addEventListener('touchend', dragEnd);

  function updateCamera(dt) {
    var bike = BC.getBike();
    if (!isDragging) {
      if (!started) {
        camOrbit.yaw += dt * 0.22;
      } else {
        camOrbit.idleTimer += dt;
        if (camOrbit.idleTimer > 2.2) {
          camOrbit.yaw += (0 - camOrbit.yaw) * Math.min(1, 2 * dt);
          camOrbit.pitch += (0 - camOrbit.pitch) * Math.min(1, 2 * dt);
        }
      }
    }
    var speedFactor = started ? THREE.MathUtils.clamp(Math.abs(BC.physics.speed) / BC.BIKE.maxSpeed, 0, 1) : 0;
    var horizontal = BC.physics.heading + camOrbit.yaw + Math.PI;
    var vertical = BASE_PITCH + camOrbit.pitch;
    var dist = 6.4 + speedFactor * 2.2;
    var cx = bike.position.x + Math.sin(horizontal) * Math.cos(vertical) * dist;
    var cz = bike.position.z + Math.cos(horizontal) * Math.cos(vertical) * dist;
    var cy = bike.position.y + 1.1 + Math.sin(vertical) * dist;
    var camGroundH = WB.heightAt(cx, cz);
    if (cy < camGroundH + 1.4) cy = camGroundH + 1.4;
    camera.position.set(cx, cy, cz);
    camera.lookAt(bike.position.x, bike.position.y + 1.05, bike.position.z);
    sun.target.position.copy(bike.position);
    sun.position.copy(bike.position).add(new THREE.Vector3(60, 90, 30));
  }

  // Score & Toast notifications
  var score = 0;
  var scoreEl = document.getElementById('score-value');
  var toastEl = document.getElementById('toast');
  var toastTimer = null;

  function showToast(text, duration) {
    toastEl.textContent = text;
    toastEl.classList.remove('show');
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { toastEl.classList.remove('show'); }, duration || 1300);
  }

  function addScore(points, label) {
    score += points;
    scoreEl.textContent = score;
    showToast('+' + points + ' ' + label);
  }
  BC.setScoreCallback(addScore);

  // Stations Popup Logic
  var activeStation = null;
  var visited = new Set();
  var popupEl = document.getElementById('station-popup');
  var popupCard = document.getElementById('popup-card');
  var popupEyebrow = document.getElementById('popup-eyebrow');
  var popupTitle = document.getElementById('popup-title');
  var popupDesc = document.getElementById('popup-desc');
  var popupLink = document.getElementById('popup-link');
  var popupIcon = document.getElementById('popup-icon');
  var trickSignShown = false;

  function openStationPopup(st) {
    activeStation = st;
    if (!visited.has(st.id)) {
      visited.add(st.id);
      addScore(100, '¡Estación!');
    }
    popupEyebrow.textContent = st.eyebrow;
    popupTitle.textContent = st.title;
    popupDesc.textContent = st.desc;
    popupIcon.innerHTML = PD.STATION_ICONS[st.id] || '';
    if (st.link) {
      popupLink.href = st.link;
      popupLink.hidden = false;
    } else {
      popupLink.hidden = true;
    }
    popupCard.style.setProperty('--station-color', window.hexStr(st.color));
    popupEl.hidden = false;
    requestAnimationFrame(function() { popupEl.classList.add('show'); });
  }

  function closeStationPopup(manual) {
    if (manual && activeStation) activeStation.dismissed = true;
    popupEl.classList.remove('show');
    setTimeout(function() {
      if (!popupEl.classList.contains('show')) popupEl.hidden = true;
    }, 250);
    activeStation = null;
  }

  document.getElementById('popup-close').addEventListener('click', function() { closeStationPopup(true); });
  document.getElementById('popup-continue').addEventListener('click', function() { closeStationPopup(true); });

  function checkStations() {
    var nearest = null, nearestDist = Infinity;
    var stations = WB.getStations();
    stations.forEach(function(st) {
      var d = Math.hypot(st.pos.x - BC.physics.x, st.pos.z - BC.physics.z);
      if (d < nearestDist) { nearestDist = d; nearest = st; }
      if (d > 9) st.dismissed = false;
      if (st.id !== 0) {
        st.flag.rotation.y += 0.02;
        st.marker.position.y = st.pos.y + Math.sin(performance.now() * 0.002 + st.id) * 0.05;
      }
    });
    if (!activeStation && nearest && nearestDist < 6.5 && !nearest.dismissed) {
      openStationPopup(nearest);
    } else if (activeStation) {
      var dActive = Math.hypot(activeStation.pos.x - BC.physics.x, activeStation.pos.z - BC.physics.z);
      if (dActive > 10) closeStationPopup(false);
    }
    var trickSignPos = WB.getTrickSignPos();
    if (trickSignPos) {
      var dSign = Math.hypot(trickSignPos.x - BC.physics.x, trickSignPos.z - BC.physics.z);
      if (dSign < 4.5) {
        if (!trickSignShown) {
          trickSignShown = true;
          showToast('¡Zona de Trucos! Saltá y encadená trucos', 2600);
        }
      } else if (dSign > 8) {
        trickSignShown = false;
      }
    }
  }

  // HUD
  var speedoEl = document.getElementById('speedo-value');
  var turboFillEl = document.getElementById('turbo-fill');
  var routePillEl = document.getElementById('route-pill');

  function updateHUD() {
    var kmh = Math.max(0, Math.round(BC.physics.speed * 6.2));
    speedoEl.textContent = kmh;
    turboFillEl.style.width = (BC.physics.turbo * 100) + '%';
    routePillEl.hidden = !BC.physics.onRoute;
  }

  function restartRun() {
    BC.resetPhysics();
    score = 0;
    scoreEl.textContent = score;
    visited.clear();
    if (activeStation) closeStationPopup(false);
    camOrbit.yaw = 0; camOrbit.pitch = 0; camOrbit.idleTimer = 0;
  }

  // Start screen & Help modal
  var startScreen = document.getElementById('start-screen');
  var started = false;
  document.getElementById('start-btn').addEventListener('click', function() {
    started = true;
    camOrbit.idleTimer = 0;
    startScreen.classList.add('hide');
    setTimeout(function() { startScreen.hidden = true; }, 500);
    setTimeout(function() { document.getElementById('hint').classList.add('fade'); }, 7000);
  });

  var helpPopupEl = document.getElementById('help-popup');
  function openHelp() {
    helpPopupEl.hidden = false;
    requestAnimationFrame(function() { helpPopupEl.classList.add('show'); });
  }
  function closeHelp() {
    helpPopupEl.classList.remove('show');
    setTimeout(function() {
      if (!helpPopupEl.classList.contains('show')) helpPopupEl.hidden = true;
    }, 250);
  }
  document.getElementById('help-btn').addEventListener('click', openHelp);
  document.getElementById('help-close').addEventListener('click', closeHelp);
  document.getElementById('help-continue').addEventListener('click', closeHelp);
  document.getElementById('restart-btn').addEventListener('click', restartRun);

  // Main animation loop
  var clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    if (started) {
      var input = getInput();
      BC.updatePhysics(dt, input);
      BC.updateBikeMesh(dt);
      BC.updateParticles(dt);
      advanceWeather(dt);
      updatePrecip(dt);
      checkStations();
      updateHUD();
    }
    updateCamera(dt);
    WB.updateBillboards(camera, BC.getBike());
    renderer.render(scene, camera);
  }

  resize();
  animate();
})();
