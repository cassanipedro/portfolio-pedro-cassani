// Main Application & Studio Ghibli Scene Controller (HD Renderer, Sound Engine, Weather, Center Trick Park & Google Calendar Meta)
(function() {
  'use strict';

  var PD = window.PortfolioData;
  var WB = window.WorldBuilder;
  var BC = window.BikeController;
  var SE = window.SoundEngine;

  var PEDRO_EMAIL = 'cassanipedro01@gmail.com';

  var canvas = document.getElementById('scene');
  var renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xdff2e8, 0.0038);

  var camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 550);

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // Gradiente Cel-Shading suave estilo Studio Ghibli
  function makeToonGradient() {
    var c = document.createElement('canvas');
    c.width = 8; c.height = 1;
    var ctx = c.getContext('2d');
    var shades = ['#3a4454', '#526073', '#738296', '#98a6b8', '#c2ccd6', '#e3e8ed', '#f7f9fa', '#ffffff'];
    for (var i = 0; i < shades.length; i++) {
      ctx.fillStyle = shades[i];
      ctx.fillRect(i, 0, 1, 1);
    }
    var tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }
  var toonGrad = makeToonGradient();
  function toonMat(color, extra) {
    var o = Object.assign({ color: color, gradientMap: toonGrad }, extra || {});
    return new THREE.MeshToonMaterial(o);
  }

  // Iluminación cálida de verano estilo Miyazaki
  var hemi = new THREE.HemisphereLight(0xfff8e7, 0x4d7c5b, 0.88);
  scene.add(hemi);
  var sun = new THREE.DirectionalLight(0xfff1d0, 1.55);
  sun.position.set(60, 95, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 230;
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45;
  sun.shadow.camera.bottom = -45;
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.015;
  scene.add(sun);
  scene.add(sun.target);

  // Cielo pintado estilo Studio Ghibli + Nubes Cúmulo 3D esponjosas en el horizonte
  var cloudGroup = new THREE.Group();
  (function buildGhibliSkyAndClouds() {
    var skyGeo = new THREE.SphereGeometry(420, 32, 24);
    var pos = skyGeo.attributes.position;
    var zenith = new THREE.Color(0x1d63b8);
    var midSky = new THREE.Color(0x56b4e9);
    var horizon = new THREE.Color(0xfef9e7);
    var skyColors = [];
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i) / 420;
      var t = THREE.MathUtils.clamp(y * 1.25 + 0.08, 0, 1);
      var c;
      if (t < 0.35) {
        c = horizon.clone().lerp(midSky, t / 0.35);
      } else {
        c = midSky.clone().lerp(zenith, (t - 0.35) / 0.65);
      }
      skyColors.push(c.r, c.g, c.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
    var skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    var cloudLitMat = new THREE.MeshBasicMaterial({ color: 0xfffdf9, fog: false });
    var cloudShadeMat = new THREE.MeshBasicMaterial({ color: 0xdceefb, fog: false });
    var cloudCount = 14;
    for (var ci = 0; ci < cloudCount; ci++) {
      var cAngle = (ci / cloudCount) * Math.PI * 2 + (ci % 2) * 0.15;
      var cDist = 230 + (ci % 3) * 35;
      var cHeight = 42 + (ci % 4) * 16;
      var singleCloud = new THREE.Group();
      singleCloud.position.set(Math.sin(cAngle) * cDist, cHeight, Math.cos(cAngle) * cDist);
      singleCloud.lookAt(0, cHeight, 0);

      var puffs = [
        [0, 0, 0, 18, true],
        [-14, -3, 2, 13, true],
        [15, -2, 1, 14, true],
        [-7, 8, 2, 12, true],
        [8, 7, 2, 11, true],
        [0, -7, -2, 16, false],
        [-13, -8, -1, 11, false],
        [13, -7, -1, 12, false]
      ];
      for (var pi = 0; pi < puffs.length; pi++) {
        var pf = puffs[pi];
        var pGeo = new THREE.SphereGeometry(pf[3], 12, 10);
        var pMesh = new THREE.Mesh(pGeo, pf[4] ? cloudLitMat : cloudShadeMat);
        pMesh.position.set(pf[0], pf[1], pf[2]);
        pMesh.scale.set(1.2, 0.85, 0.7);
        singleCloud.add(pMesh);
      }
      cloudGroup.add(singleCloud);
    }
    scene.add(cloudGroup);
  })();

  // Build World, Road, Stations + Finish Line Arch, Center Trick Park (Ramp + Grind), Foliage & Africa Twin Motorcycle
  WB.buildTerrain(scene, toonGrad);
  WB.buildStations(scene, toonGrad, toonMat);
  WB.buildCircuitRoad(scene, toonGrad, 0xffd166);
  WB.buildTrickPark(scene, toonMat);
  WB.buildTreesAndRocks(scene, toonMat);
  BC.initBike(scene, toonGrad);
  BC.initParticles(scene);

  // Weather system + Audio Ambience Synchronization
  var WEATHER = ['sun', 'rain', 'snow'];
  var WEATHER_ICON = { sun: '☀', rain: '🌧', snow: '❄' };
  var WEATHER_LABEL = { sun: 'Clima soleado', rain: 'Lluvia suave', snow: 'Nevada suave' };
  var weatherParams = {
    sun:  { fog: 0xdff2e8, fogDensity: 0.0038, hemiSky: 0xfff8e7, hemiGround: 0x4d7c5b, hemiI: 0.88, sunColor: 0xfff1d0, sunI: 1.55, precip: 'none' },
    rain: { fog: 0x6c7d8c, fogDensity: 0.0085, hemiSky: 0xa8bac8, hemiGround: 0x3b4854, hemiI: 0.62, sunColor: 0xd8e2ec, sunI: 0.65, precip: 'rain' },
    snow: { fog: 0xe6f0f5, fogDensity: 0.0065, hemiSky: 0xf0f7fa, hemiGround: 0x8d99ae, hemiI: 0.82, sunColor: 0xffffff, sunI: 1.05, precip: 'snow' }
  };
  var weatherIdx = 0, weatherTimer = 0, WEATHER_CYCLE = 42, WEATHER_TRANSITION = 3.5, transT = 1;
  var fromParams = weatherParams.sun, toParams = weatherParams.sun;
  var currentPrecip = 'none';
  var weatherPillEl = document.getElementById('weather-pill');

  var PRECIP_COUNT = 65;
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

  function switchWeatherTo(newIdx, manualToast) {
    weatherTimer = 0;
    weatherIdx = newIdx % WEATHER.length;
    var mode = WEATHER[weatherIdx];
    fromParams = toParams;
    toParams = weatherParams[mode];
    transT = 0;
    currentPrecip = toParams.precip;
    reconfigurePrecip();
    weatherPillEl.textContent = WEATHER_ICON[mode];
    if (SE) SE.setWeatherMode(mode);
    if (manualToast) showToast(WEATHER_ICON[mode] + ' ' + WEATHER_LABEL[mode], 1500);
  }

  weatherPillEl.addEventListener('click', function() {
    if (SE) SE.init();
    switchWeatherTo(weatherIdx + 1, true);
  });

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
    if (weatherTimer > WEATHER_CYCLE) {
      switchWeatherTo(weatherIdx + 1, false);
    }
  }

  // Sound Mute/Unmute button
  var soundBtnEl = document.getElementById('sound-btn');
  if (soundBtnEl) {
    soundBtnEl.addEventListener('click', function() {
      if (!SE) return;
      var isMuted = SE.toggleMute();
      soundBtnEl.textContent = isMuted ? '🔇' : '🔊';
      showToast(isMuted ? 'Sonido silenciado' : 'Sonido activado 🔊', 1200);
    });
  }

  // Input & Ergonomic Multi-Touch Mobile Controls
  var keys = {};
  window.addEventListener('keydown', function(e) {
    var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (SE) SE.init();
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
        if (SE) SE.init();
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
    if (!finishPopupEl.hidden) {
      return { forward: false, back: false, left: false, right: false, turbo: false, trick: false };
    }
    return {
      forward: isDown('KeyW', 'ArrowUp') || touchState.forward,
      back: isDown('KeyS', 'ArrowDown') || touchState.back,
      left: isDown('KeyA', 'ArrowLeft') || touchState.left,
      right: isDown('KeyD', 'ArrowRight') || touchState.right,
      turbo: isDown('ShiftLeft', 'ShiftRight') || touchState.turbo,
      trick: isDown('Space') || touchState.trick
    };
  }

  // Camera drag / orbit + Dynamic FOV boost on Turbo
  var camOrbit = { yaw: 0, pitch: 0, idleTimer: 0 };
  var BASE_PITCH = 0.36;
  var isDragging = false, dragLastX = 0, dragLastY = 0;
  function dragStart(x, y) { isDragging = true; dragLastX = x; dragLastY = y; camOrbit.idleTimer = 0; }
  function dragMove(x, y) {
    if (!isDragging) return;
    var dx = x - dragLastX, dy = y - dragLastY;
    dragLastX = x; dragLastY = y;
    camOrbit.yaw -= dx * 0.007;
    camOrbit.pitch = THREE.MathUtils.clamp(camOrbit.pitch - dy * 0.005, -0.28, 0.55);
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
    var targetFov = (started && (BC.physics.turboActive || BC.physics.grinding)) ? 58 : 50;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, 6 * dt);
      camera.updateProjectionMatrix();
    }

    var speedFactor = started ? THREE.MathUtils.clamp(Math.abs(BC.physics.speed) / BC.BIKE.maxSpeed, 0, 1) : 0;
    var horizontal = BC.physics.heading + camOrbit.yaw + Math.PI;
    var vertical = BASE_PITCH + camOrbit.pitch;
    var dist = 6.2 + speedFactor * 2.0;
    var cx = bike.position.x + Math.sin(horizontal) * Math.cos(vertical) * dist;
    var cz = bike.position.z + Math.cos(horizontal) * Math.cos(vertical) * dist;
    var cy = bike.position.y + 1.15 + Math.sin(vertical) * dist;
    var camGroundH = WB.heightAt(cx, cz);
    if (cy < camGroundH + 1.35) cy = camGroundH + 1.35;
    camera.position.set(cx, cy, cz);
    camera.lookAt(bike.position.x, bike.position.y + 1.1, bike.position.z);
    sun.target.position.copy(bike.position);
    sun.position.copy(bike.position).add(new THREE.Vector3(60, 95, 35));
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

  // Stations & Finish Line Arch Popup Logic
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

  // ============================================================================
  // META (FINISH LINE) & GOOGLE CALENDAR + EMAIL INVITATION TO PEDRO
  // ============================================================================
  var finishPopupEl = document.getElementById('finish-popup');
  var finishStatsEl = document.getElementById('finish-stats');
  var apptFormEl = document.getElementById('appt-form');
  var apptFeedbackEl = document.getElementById('appt-feedback');
  var finishReachedOnce = false;

  (function initDefaultAppointmentDate() {
    var dateInput = document.getElementById('appt-date');
    if (!dateInput) return;
    var tomorrow = new Date(Date.now() + 86400000);
    var yyyy = tomorrow.getFullYear();
    var mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    var dd = String(tomorrow.getDate()).padStart(2, '0');
    dateInput.value = yyyy + '-' + mm + '-' + dd;
    dateInput.min = yyyy + '-' + mm + '-' + dd;
  })();

  document.querySelectorAll('.motive-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      document.querySelectorAll('.motive-chip').forEach(function(c) { c.classList.remove('active'); });
      chip.classList.add('active');
      var reasonEl = document.getElementById('appt-reason');
      var motive = chip.getAttribute('data-motive');
      if (!reasonEl.value.trim()) {
        reasonEl.value = motive + ': ';
      } else if (reasonEl.value.indexOf(motive) === -1) {
        reasonEl.value = motive + ' — ' + reasonEl.value;
      }
      reasonEl.focus();
    });
  });

  function formatGCalDateTime(dateStr, timeStr, durationMin) {
    var partsD = (dateStr || '2026-10-20').split('-');
    var partsT = (timeStr || '11:00').split(':');
    var start = new Date(
      parseInt(partsD[0], 10),
      parseInt(partsD[1], 10) - 1,
      parseInt(partsD[2], 10),
      parseInt(partsT[0], 10),
      parseInt(partsT[1], 10),
      0
    );
    var end = new Date(start.getTime() + (parseInt(durationMin, 10) || 30) * 60000);
    function pad(n) { return String(n).padStart(2, '0'); }
    function toGCal(d) {
      return d.getUTCFullYear() +
        pad(d.getUTCMonth() + 1) +
        pad(d.getUTCDate()) + 'T' +
        pad(d.getUTCHours()) +
        pad(d.getUTCMinutes()) + '00Z';
    }
    return toGCal(start) + '/' + toGCal(end);
  }

  function buildGoogleCalendarUrl(data) {
    var dates = formatGCalDateTime(data.date, data.time, data.duration);
    var title = 'Reunión Portfolio: ' + data.name + ' & Pedro Cassani';
    var details = [
      'Solicitud de reunión enviada desde el Portfolio 3D de Pedro Cassani (Sendero Cumbre).',
      '',
      '• Solicitante: ' + data.name,
      '• Email de contacto: ' + data.email,
      '• Motivo de la reunión:',
      data.reason,
      '',
      'Invitado: Pedro Cassani (' + PEDRO_EMAIL + ')'
    ].join('\n');

    var params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: dates,
      details: details,
      add: PEDRO_EMAIL,
      location: 'Google Meet / Videollamada'
    });
    return 'https://calendar.google.com/calendar/render?' + params.toString();
  }

  function getFormData() {
    var name = document.getElementById('appt-name').value.trim();
    var email = document.getElementById('appt-email').value.trim();
    var date = document.getElementById('appt-date').value;
    var time = document.getElementById('appt-time').value;
    var duration = document.getElementById('appt-duration').value;
    var reason = document.getElementById('appt-reason').value.trim();
    return {
      name: name,
      email: email,
      date: date,
      time: time,
      duration: duration,
      reason: reason
    };
  }

  apptFormEl.addEventListener('submit', function(e) {
    e.preventDefault();
    var data = getFormData();
    if (!data.name || !data.email || !data.reason) {
      showToast('Completá tu nombre, email y el motivo de la reunión', 2000);
      return;
    }
    var gcalUrl = buildGoogleCalendarUrl(data);

    apptFeedbackEl.hidden = false;
    apptFeedbackEl.innerHTML = '✅ <strong>¡Abriendo tu Google Calendar!</strong> Al guardar el evento en tu calendario, Google le enviará automáticamente la invitación por mail y directo al Google Calendar de <strong>Pedro (' + PEDRO_EMAIL + ')</strong> para que la acepte o rechace desde su propio Calendar.';

    window.open(gcalUrl, '_blank', 'noopener');
  });

  document.getElementById('btn-submit-email').addEventListener('click', function() {
    var data = getFormData();
    if (!data.name || !data.reason) {
      showToast('Completá tu nombre y el motivo de la reunión primero', 2200);
      return;
    }
    var gcalUrl = buildGoogleCalendarUrl(data);
    var subject = encodeURIComponent('Solicitud de Reunión (Portfolio 3D): ' + data.name);
    var body = encodeURIComponent(
      'Hola Pedro,\n\n' +
      'Recorrí tu Portfolio 3D Sendero Cumbre y me gustaría agendar una reunión con vos:\n\n' +
      '• Nombre / Empresa: ' + data.name + '\n' +
      '• Email: ' + (data.email || 'No especificado') + '\n' +
      '• Fecha y Hora propuesta: ' + data.date + ' a las ' + data.time + ' hs (' + data.duration + ' min)\n' +
      '• Motivo de la reunión:\n' + data.reason + '\n\n' +
      'Link para agendar en tu Google Calendar:\n' + gcalUrl + '\n\n' +
      '¡Saludos!'
    );
    window.location.href = 'mailto:' + PEDRO_EMAIL + '?subject=' + subject + '&body=' + body;
  });

  function openFinishPopup(fromCrossing) {
    if (activeStation) closeStationPopup(false);
    if (fromCrossing && !finishReachedOnce) {
      finishReachedOnce = true;
      addScore(300, '🏁 ¡Meta Alcanzada!');
      if (SE) SE.playFanfare();
    }
    finishStatsEl.textContent = 'Puntaje: ' + score + ' pts · Estaciones visitadas: ' + visited.size + '/5 · Al agendar en tu Google Calendar, a Pedro le llega la invitación por mail y en su Calendar para aceptarla.';
    finishPopupEl.hidden = false;
    requestAnimationFrame(function() { finishPopupEl.classList.add('show'); });
  }

  function closeFinishPopup() {
    var fl = WB.getFinishLine();
    if (fl) fl.dismissed = true;
    finishPopupEl.classList.remove('show');
    setTimeout(function() {
      if (!finishPopupEl.classList.contains('show')) finishPopupEl.hidden = true;
    }, 250);
  }

  document.getElementById('finish-open-btn').addEventListener('click', function() {
    if (SE) SE.init();
    openFinishPopup(false);
  });
  document.getElementById('finish-close').addEventListener('click', closeFinishPopup);
  document.getElementById('finish-continue').addEventListener('click', closeFinishPopup);

  function checkStationsAndFinish() {
    var nearest = null, nearestDist = Infinity;
    var stations = WB.getStations();
    stations.forEach(function(st) {
      var d = Math.hypot(st.pos.x - BC.physics.x, st.pos.z - BC.physics.z);
      var trigR = st.triggerRadius || 6.5;
      if (d < trigR && d < nearestDist) {
        nearestDist = d;
        nearest = st;
      }
      if (d > trigR + 2.8) st.dismissed = false;
      if (st.id !== 0) {
        st.flag.rotation.y += 0.02;
        st.marker.position.y = st.pos.y + Math.sin(performance.now() * 0.002 + st.id) * 0.05;
      }
    });

    // No abrir popups mientras el jugador está haciendo el truco Rampa + Grind en el carril central (x cerca de 0)
    var inGrindCorridor = Math.abs(BC.physics.x) < 7.5 && Math.abs(BC.physics.z) < 15.5;
    var busyDoingTrick = BC.physics.airborne || BC.physics.grinding || inGrindCorridor;

    if (!activeStation && !busyDoingTrick && finishPopupEl.hidden && nearest && !nearest.dismissed) {
      openStationPopup(nearest);
    } else if (activeStation) {
      var dActive = Math.hypot(activeStation.pos.x - BC.physics.x, activeStation.pos.z - BC.physics.z);
      if (dActive > (activeStation.triggerRadius || 6.5) + 3.5 || BC.physics.grinding) {
        closeStationPopup(false);
      }
    }

    // Comprobar si la moto cruza el Arco de Meta 3D
    var fl = WB.getFinishLine();
    if (fl) {
      if (fl.star) fl.star.rotation.y += 0.035;
      var dFinish = Math.hypot(fl.pos.x - BC.physics.x, fl.pos.z - BC.physics.z);
      if (dFinish > 11) {
        fl.dismissed = false;
      } else if (dFinish < 4.8 && !fl.dismissed && finishPopupEl.hidden) {
        openFinishPopup(true);
      }
    }

    var trickSignPos = WB.getTrickSignPos();
    if (trickSignPos) {
      var dSign = Math.hypot(trickSignPos.x - BC.physics.x, trickSignPos.z - BC.physics.z);
      if (dSign < 13 && !BC.physics.grinding) {
        if (!trickSignShown) {
          trickSignShown = true;
          showToast('⚡ ¡Zona de Trucos Central! Saltá la rampa hacia el riel para hacer GRIND', 3200);
        }
      } else if (dSign > 18) {
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
    finishReachedOnce = false;
    if (activeStation) closeStationPopup(false);
    if (!finishPopupEl.hidden) closeFinishPopup();
    camOrbit.yaw = 0; camOrbit.pitch = 0; camOrbit.idleTimer = 0;
  }

  // Start screen & Help modal
  var startScreen = document.getElementById('start-screen');
  var started = false;
  document.getElementById('start-btn').addEventListener('click', function() {
    started = true;
    if (SE) {
      SE.init();
      SE.setWeatherMode(WEATHER[weatherIdx]);
    }
    camOrbit.idleTimer = 0;
    startScreen.classList.add('hide');
    setTimeout(function() { startScreen.hidden = true; }, 500);
    setTimeout(function() { document.getElementById('hint').classList.add('fade'); }, 8000);
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
    cloudGroup.rotation.y += dt * 0.004;
    if (started) {
      var input = getInput();
      BC.updatePhysics(dt, input);
      BC.updateBikeMesh(dt);
      BC.updateParticles(dt);
      if (SE) SE.update(dt, BC.physics);
      advanceWeather(dt);
      updatePrecip(dt);
      checkStationsAndFinish();
      updateHUD();
    }
    updateCamera(dt);
    renderer.render(scene, camera);
  }

  resize();
  animate();
})();
