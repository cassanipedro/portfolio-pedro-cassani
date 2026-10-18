// Motorcycle 3D Loader (Studio Ghibli Style + Twin Exhaust Turbo Flames + Animated Rider), Suspension & Responsive Mechanics
window.BikeController = (function() {
  'use strict';

  var WB = window.WorldBuilder;
  var PD = window.PortfolioData;

  var BIKE = {
    maxSpeed: 29,
    accel: 22,
    jumpPower: 13,
    climb: 2.0,
    lean: 0.85,
    turboMult: 1.48,
    baseOffset: 0.06
  };

  var GRAVITY = 20;
  var RAMP_BASE_POWER = 10.5;
  var TRICK_SPIN_RATE = 7.4;
  var ROUTE_BOOST = 1.25;
  var STEER_SMOOTH = 8.5;
  var TURN_RATE = 2.3;
  var FRICTION = 6.5;
  var MAX_REV = -9;
  var BIKE_COLLIDE_R = 0.55;

  var physics = {
    x: 0, z: 0, y: 0,
    heading: 0, speed: 0, steer: 0,
    pitch: 0, roll: 0, turbo: 1,
    turboActive: false, throttle: 0,
    airborne: false, yVel: 0, airTime: 0,
    trickRotation: 0, driftAccum: 0,
    onRoute: false, wheelie: 0, wheelieAccum: 0,
    climbSlope: 0, jumpCooldown: 0, skidTimer: 0,
    suspOffset: 0, suspVel: 0
  };

  var SPAWN_X = 0, SPAWN_Z = PD.CIRCUIT_RADIUS, SPAWN_HEADING = Math.PI / 2;
  var bike = null;
  var riderGroup = null;
  var riderTorso = null;
  var riderHead = null;
  var scarfNodes = [];
  var brakeLightMat = null;

  // Sistemas de Llamas de Fuego para el Turbo (3D + Luz + Partículas de Fuego)
  var exhaustNozzles = [];
  var turboFlameLight = null;
  var flameTex = null;
  var flamePool = [];
  var flameCursor = 0;

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

  // Construcción de detalles mecánicos de alta calidad para la moto, escapes dobles con llamas 3D y piloto Ghibli
  function buildGhibliRiderAndDetails(bikeGroup, toonGrad) {
    function gMat(color, extra) {
      return new THREE.MeshToonMaterial(Object.assign({ color: color, gradientMap: toonGrad }, extra || {}));
    }

    var chromeMat = gMat(0xe2e8f0);
    var darkMetalMat = gMat(0x282c34);
    var copperMat = gMat(0xd97742);
    var goldMat = gMat(0xe9c46a);
    var redSpringMat = gMat(0xe63946);

    // 1. Faro delantero cálido con aro cromado + visera + velocímetro doble retro + espejos
    var bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.08, 16), chromeMat);
    bezel.rotation.x = Math.PI / 2;
    bezel.position.set(0, 0.88, 1.05);
    bikeGroup.add(bezel);

    var headlight = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff5b8 })
    );
    headlight.scale.set(1.05, 0.95, 0.5);
    headlight.position.set(0, 0.88, 1.08);
    bikeGroup.add(headlight);

    // Doble reloj velocímetro / tacómetro en el manubrio
    [-0.075, 0.075].forEach(function(gx) {
      var gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.05, 12), chromeMat);
      gauge.rotation.x = -0.6;
      gauge.position.set(gx, 1.04, 0.72);
      bikeGroup.add(gauge);
    });

    // Horquilla telescópica cromada delantera y amortiguadores traseros rojos
    [-0.11, 0.11].forEach(function(fx) {
      var fork = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.022, 0.72, 10), chromeMat);
      fork.rotation.x = 0.36;
      fork.position.set(fx, 0.62, 0.82);
      bikeGroup.add(fork);

      // Amortiguador trasero espiralado
      var shock = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.42, 10), redSpringMat);
      shock.rotation.x = -0.42;
      shock.position.set(fx * 1.25, 0.56, -0.58);
      bikeGroup.add(shock);
    });

    // Parabrisas translúcido estilo café-racer Ghibli
    var visorMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.52,
      side: THREE.DoubleSide
    });
    var visor = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.32, 14, 1, true, -Math.PI * 0.35, Math.PI * 0.7), visorMat);
    visor.rotation.x = -0.55;
    visor.position.set(0, 1.06, 0.82);
    bikeGroup.add(visor);

    // Luz de freno trasera reactiva
    brakeLightMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
    var tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.075, 0.06), brakeLightMat);
    tailLight.position.set(0, 0.88, -1.06);
    bikeGroup.add(tailLight);

    // 2. ESCAPES DOBLES CROMADOS + LLAMAS 3D DE FUEGO DEL TURBO
    exhaustNozzles = [];
    var coreFlameMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.95 });
    var midFlameMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.88 });
    var outerFlameMat = new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.78 });

    [-0.175, 0.175].forEach(function(ex) {
      // Colector de bronce desde el motor
      var headerPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.65, 10), copperMat);
      headerPipe.rotation.x = Math.PI / 2 + 0.12;
      headerPipe.position.set(ex * 0.88, 0.38, -0.25);
      bikeGroup.add(headerPipe);

      // Silenciador trasero cromado inclinado hacia arriba
      var mufflerGroup = new THREE.Group();
      mufflerGroup.position.set(ex, 0.52, -0.82);
      mufflerGroup.rotation.x = 0.16;

      var mufflerBody = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.044, 0.58, 14), chromeMat);
      mufflerBody.rotation.x = Math.PI / 2;
      mufflerGroup.add(mufflerBody);

      var mufflerTip = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.056, 0.1, 14), darkMetalMat);
      mufflerTip.rotation.x = Math.PI / 2;
      mufflerTip.position.z = -0.31;
      mufflerGroup.add(mufflerTip);

      // Conos de fuego 3D multicapa que salen de cada escape al activar el Turbo
      var flamePivot = new THREE.Group();
      flamePivot.position.set(0, 0, -0.35);
      flamePivot.visible = false;

      var coreCone = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.45, 12), coreFlameMat);
      coreCone.rotation.x = -Math.PI / 2;
      coreCone.position.z = -0.22;
      flamePivot.add(coreCone);

      var midCone = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.78, 12), midFlameMat);
      midCone.rotation.x = -Math.PI / 2;
      midCone.position.z = -0.36;
      flamePivot.add(midCone);

      var outerCone = new THREE.Mesh(new THREE.ConeGeometry(0.095, 1.15, 12), outerFlameMat);
      outerCone.rotation.x = -Math.PI / 2;
      outerCone.position.z = -0.52;
      flamePivot.add(outerCone);

      mufflerGroup.add(flamePivot);
      bikeGroup.add(mufflerGroup);

      exhaustNozzles.push({
        group: mufflerGroup,
        flamePivot: flamePivot,
        coreCone: coreCone,
        midCone: midCone,
        outerCone: outerCone,
        localTip: new THREE.Vector3(ex, 0.56, -1.16)
      });
    });

    // Luz dinámica naranja de fuego que ilumina el asfalto cuando salen llamas del turbo
    turboFlameLight = new THREE.PointLight(0xff5e00, 0, 6.0, 1.8);
    turboFlameLight.position.set(0, 0.62, -1.45);
    bikeGroup.add(turboFlameLight);

    // 3. Piloto estilo Studio Ghibli articulado (se inclina en las curvas y se agacha con el turbo)
    riderGroup = new THREE.Group();
    riderGroup.position.set(0, 0.82, -0.08);

    var jacketMat = gMat(0x2b5876);
    var pantsMat = gMat(0x3d405b);
    var helmetMat = gMat(0xfdf8ee);
    var leatherMat = gMat(0x6f4518);
    var scarfMat = gMat(0xe63946, { side: THREE.DoubleSide });

    riderTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.52, 12), jacketMat);
    riderTorso.position.set(0, 0.32, 0.08);
    riderTorso.rotation.x = 0.52;
    riderTorso.castShadow = true;
    riderGroup.add(riderTorso);

    var shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), jacketMat);
    shoulders.scale.set(1.25, 0.7, 0.9);
    shoulders.position.set(0, 0.50, 0.19);
    riderGroup.add(shoulders);

    [-0.19, 0.19].forEach(function(sx) {
      var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.048, 0.46, 10), jacketMat);
      arm.position.set(sx * 0.88, 0.40, 0.38);
      arm.rotation.x = 1.18;
      arm.rotation.z = sx * -0.22;
      arm.castShadow = true;
      riderGroup.add(arm);

      var glove = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), leatherMat);
      glove.position.set(sx * 0.75, 0.29, 0.58);
      riderGroup.add(glove);

      var thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.062, 0.38, 10), pantsMat);
      thigh.position.set(sx * 0.82, 0.05, 0.06);
      thigh.rotation.x = -0.85;
      riderGroup.add(thigh);

      var boot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.24, 0.12), leatherMat);
      boot.position.set(sx * 0.84, -0.14, 0.02);
      boot.rotation.x = 0.35;
      riderGroup.add(boot);
    });

    riderHead = new THREE.Group();
    riderHead.position.set(0, 0.66, 0.24);
    var helmet = new THREE.Mesh(new THREE.SphereGeometry(0.175, 16, 14), helmetMat);
    helmet.castShadow = true;
    riderHead.add(helmet);

    var stripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.36), gMat(0xe63946));
    riderHead.add(stripe);

    var goggleStrap = new THREE.Mesh(new THREE.CylinderGeometry(0.178, 0.178, 0.045, 16), leatherMat);
    goggleStrap.rotation.x = -0.15;
    goggleStrap.position.y = 0.02;
    riderHead.add(goggleStrap);

    [-0.065, 0.065].forEach(function(gx) {
      var rim = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.04, 12), goldMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(gx, 0.03, 0.16);
      riderHead.add(rim);
      var lens = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), new THREE.MeshBasicMaterial({ color: 0x7dd3fc }));
      lens.position.set(gx, 0.03, 0.182);
      riderHead.add(lens);
    });
    riderGroup.add(riderHead);

    // Bufanda roja animada al viento (5 segmentos articulados)
    scarfNodes = [];
    var scarfRoot = new THREE.Group();
    scarfRoot.position.set(0, 0.54, 0.14);
    riderGroup.add(scarfRoot);

    var parentNode = scarfRoot;
    for (var si = 0; si < 5; si++) {
      var segPivot = new THREE.Group();
      segPivot.position.set(0, 0, si === 0 ? -0.06 : -0.14);
      var segMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.13 - si * 0.015, 0.03, 0.15),
        scarfMat
      );
      segMesh.position.z = -0.07;
      segMesh.castShadow = true;
      segPivot.add(segMesh);
      parentNode.add(segPivot);
      scarfNodes.push(segPivot);
      parentNode = segPivot;
    }

    bikeGroup.add(riderGroup);
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

    buildGhibliRiderAndDetails(bike, toonGrad);

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

      var ghibliRed = new THREE.Color(0xd63426);
      var ghibliCream = new THREE.Color(0xfdf8ee);
      var ghibliChrome = new THREE.Color(0xd8e2ec);
      var ghibliTire = new THREE.Color(0x22252a);
      var bodyPanelNames = ['test008_test041', 'test001_test017', 'test_test001'];
      var accentNames = ['test011_test046', 'test002_test010'];
      var chromeNames = ['test013_test047', 'test012_test047', 'test007_test029'];
      var wheelNames = ['test005_test025', 'test003_test025'];

      model.traverse(function(o) {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          if (o.geometry) {
            o.geometry.computeVertexNormals();
          }
          var col = new THREE.Color(0x2f343d);
          if (bodyPanelNames.indexOf(o.name) !== -1) col = ghibliRed.clone();
          else if (accentNames.indexOf(o.name) !== -1) col = ghibliCream.clone();
          else if (chromeNames.indexOf(o.name) !== -1) col = ghibliChrome.clone();
          else if (wheelNames.indexOf(o.name) !== -1) col = ghibliTire.clone();
          o.material = new THREE.MeshToonMaterial({ color: col, gradientMap: toonGrad });
        }
      });

      // Llantas doradas con rayos y discos de freno ventilados
      var rimMat = new THREE.MeshToonMaterial({ color: 0xe9c46a, gradientMap: toonGrad });
      var discMat = new THREE.MeshToonMaterial({ color: 0xcbd5e1, gradientMap: toonGrad });
      [frontInfo, rearInfo].forEach(function(wInfo) {
        if (!wInfo) return;
        var rim = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.42, 16), rimMat);
        rim.rotation.z = Math.PI / 2;
        wInfo.pivot.add(rim);

        var brakeDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.46, 14), discMat);
        brakeDisc.rotation.z = Math.PI / 2;
        wInfo.pivot.add(brakeDisc);

        for (var sp = 0; sp < 4; sp++) {
          var spoke = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.38, 0.08), rimMat);
          spoke.rotation.x = (sp / 4) * Math.PI;
          wInfo.pivot.add(spoke);
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
      pctx.fillStyle = '#1d242b'; pctx.fillRect(0, 0, 64, 32);
      pctx.strokeStyle = '#e9c46a'; pctx.lineWidth = 2.5; pctx.strokeRect(2, 2, 60, 28);
      pctx.fillStyle = '#fdf8ee';
      pctx.font = 'bold 15px monospace';
      pctx.textAlign = 'center'; pctx.textBaseline = 'middle';
      pctx.fillText('</DEV>', 32, 18);
      var plateTex = new THREE.CanvasTexture(plateC);
      var plateMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.34, 0.17),
        new THREE.MeshBasicMaterial({ map: plateTex, side: THREE.DoubleSide })
      );
      plateMesh.position.set(0, 0.76, -1.08);
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
    grad.addColorStop(0, 'rgba(255,252,245,0.92)');
    grad.addColorStop(1, 'rgba(255,252,245,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
    dustTex = new THREE.CanvasTexture(cnv);

    var dustGroup = new THREE.Group();
    for (var di = 0; di < 30; di++) {
      var dmat = new THREE.SpriteMaterial({ map: dustTex, color: 0xf4ece1, transparent: true, opacity: 0, depthWrite: false });
      var dspr = new THREE.Sprite(dmat);
      dspr.scale.set(0.1, 0.1, 1);
      dspr.userData.life = 0;
      dustGroup.add(dspr);
      dustPool.push(dspr);
    }
    scene.add(dustGroup);

    // Textura radial de fuego brillante para las partículas del Turbo
    var fCnv = document.createElement('canvas');
    fCnv.width = fCnv.height = 64;
    var fCtx = fCnv.getContext('2d');
    var fGrad = fCtx.createRadialGradient(32, 32, 2, 32, 32, 32);
    fGrad.addColorStop(0, 'rgba(255, 255, 220, 1)');
    fGrad.addColorStop(0.32, 'rgba(255, 195, 30, 0.95)');
    fGrad.addColorStop(0.68, 'rgba(255, 69, 0, 0.65)');
    fGrad.addColorStop(1, 'rgba(220, 20, 0, 0)');
    fCtx.fillStyle = fGrad;
    fCtx.fillRect(0, 0, 64, 64);
    flameTex = new THREE.CanvasTexture(fCnv);

    var flameGroup = new THREE.Group();
    for (var fi = 0; fi < 40; fi++) {
      var fmat = new THREE.SpriteMaterial({
        map: flameTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      var fspr = new THREE.Sprite(fmat);
      fspr.scale.set(0.1, 0.1, 1);
      fspr.userData.life = 0;
      fspr.userData.maxLife = 0.25;
      fspr.userData.vx = 0;
      fspr.userData.vy = 0;
      fspr.userData.vz = 0;
      flameGroup.add(fspr);
      flamePool.push(fspr);
    }
    scene.add(flameGroup);

    var skC = document.createElement('canvas');
    skC.width = 16; skC.height = 16;
    var skCtx = skC.getContext('2d');
    var skGrad = skCtx.createLinearGradient(0, 0, 16, 0);
    skGrad.addColorStop(0, 'rgba(20,16,12,0)');
    skGrad.addColorStop(0.5, 'rgba(20,16,12,0.65)');
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
      var ls = 24;
      var lc = document.createElement('canvas');
      lc.width = ls; lc.height = ls;
      var lctx = lc.getContext('2d');
      lctx.fillStyle = colorHex;
      lctx.beginPath();
      lctx.moveTo(ls / 2, 0);
      lctx.quadraticCurveTo(ls, ls / 2, ls / 2, ls);
      lctx.quadraticCurveTo(0, ls / 2, ls / 2, 0);
      lctx.fill();
      return new THREE.CanvasTexture(lc);
    }

    var leafTexes = [makeLeafTexture('#7fd16b'), makeLeafTexture('#ffd166'), makeLeafTexture('#ff9ebb')];
    var fallLeafGroup = new THREE.Group();
    var treePoints = WB.getTreeSpawnPoints();

    function resetFallLeaf(it) {
      if (treePoints.length === 0) { it.spr.position.set(0, -50, 0); return; }
      var p = treePoints[Math.floor(Math.random() * treePoints.length)];
      it.spr.position.set(p.x + (Math.random() - 0.5) * 1.6, p.y + Math.random() * 0.7, p.z + (Math.random() - 0.5) * 1.6);
    }

    for (var li = 0; li < 36; li++) {
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

  function spawnTurboFlameParticle(worldPos, heading) {
    if (!flamePool.length) return;
    var spr = flamePool[flameCursor];
    flameCursor = (flameCursor + 1) % flamePool.length;
    var backX = -Math.sin(heading);
    var backZ = -Math.cos(heading);
    spr.position.copy(worldPos).add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.08,
      (Math.random() - 0.5) * 0.08,
      (Math.random() - 0.5) * 0.08
    ));
    var jetSpeed = 6.5 + Math.random() * 5.5;
    spr.userData.vx = backX * jetSpeed + (Math.random() - 0.5) * 1.4;
    spr.userData.vy = 0.4 + Math.random() * 1.2;
    spr.userData.vz = backZ * jetSpeed + (Math.random() - 0.5) * 1.4;
    spr.userData.maxLife = 0.18 + Math.random() * 0.12;
    spr.userData.life = spr.userData.maxLife;
    spr.scale.set(0.28, 0.28, 1);
    spr.material.opacity = 0.95;
  }

  function spawnSkidSegment(pos, heading) {
    if (!skidPool.length) return;
    var it = skidPool[skidCursor];
    skidCursor = (skidCursor + 1) % skidPool.length;
    it.mesh.position.set(pos.x, pos.y + 0.03, pos.z);
    it.mesh.rotation.set(-Math.PI / 2, heading, 0);
    it.mesh.material.opacity = 0.65;
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
        if (bfx * rfx + bfz * rfz > 0.3 && Math.abs(physics.speed) > 7) {
          physics.airborne = true;
          physics.yVel = RAMP_BASE_POWER * (BIKE.jumpPower / 10) * rp.power;
          physics.airTime = 0;
          physics.trickRotation = 0;
          physics.climbSlope = 0;
          spawnDust(bike.position, 1);
          if (window.SoundEngine) window.SoundEngine.playJump();
          return;
        }
      }
    }
  }

  // Salto chico y divertido únicamente en la cresta de las 2 lomitas suaves, sin perder control de la ruta
  function checkHillLaunch(dt) {
    if (physics.jumpCooldown > 0) physics.jumpCooldown = Math.max(0, physics.jumpCooldown - dt);
    if (physics.airborne || physics.jumpCooldown > 0) return;

    var spd = Math.abs(physics.speed);
    var dir = physics.speed >= 0 ? 1 : -1;
    var mfx = Math.sin(physics.heading) * dir, mfz = Math.cos(physics.heading) * dir;

    var hBack = groundSurfaceHeight(physics.x - mfx * 1.5, physics.z - mfz * 1.5);
    var hNow  = groundSurfaceHeight(physics.x, physics.z);
    var hFwd  = groundSurfaceHeight(physics.x + mfx * 1.5, physics.z + mfz * 1.5);
    var hFar  = groundSurfaceHeight(physics.x + mfx * 3.2, physics.z + mfz * 3.2);

    var slopeBehind = (hNow - hBack) / 1.5;
    var slopeAhead  = (hFwd - hNow) / 1.5;
    var slopeFar    = (hFar - hNow) / 3.2;

    if (slopeBehind > physics.climbSlope) {
      physics.climbSlope += (slopeBehind - physics.climbSlope) * Math.min(1, 14 * dt);
    } else {
      physics.climbSlope *= Math.max(0, 1 - 3.0 * dt);
    }

    if (spd > 11.0 && physics.climbSlope > 0.18 && slopeAhead < 0.08 && (physics.climbSlope - slopeFar) > 0.22) {
      physics.airborne = true;
      physics.yVel = THREE.MathUtils.clamp(spd * 0.26 + 3.2, 6.2, 9.4);
      physics.airTime = 0;
      physics.trickRotation = 0;
      physics.climbSlope = 0;
      physics.jumpCooldown = 1.2;
      spawnDust(bike.position, 0.85);
      if (window.SoundEngine) window.SoundEngine.playJump();
    }
  }

  function landTrick() {
    var fullRots = Math.floor(Math.abs(physics.trickRotation) / (Math.PI * 2) + 0.15);
    if (fullRots >= 1) {
      onScoreCallback(fullRots * 250, fullRots > 1 ? '¡Doble mortal!' : '¡Mortal!');
    } else if (physics.airTime > 0.28) {
      onScoreCallback(Math.round(physics.airTime * 80), '¡Salto!');
    }
    // Compresión realista de suspensión al aterrizar
    physics.suspVel = -2.4;
    physics.trickRotation = 0;
    physics.airTime = 0;
    spawnDust(bike.position, 0.85);
    if (window.SoundEngine) window.SoundEngine.playLand();
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
        physics.speed *= 0.35;
        if (Math.abs(physics.speed) > 4) spawnDust(bike.position, 0.7);
      }
    }
  }

  function updatePhysics(dt, input) {
    var B = BIKE;
    var steerTarget = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    physics.steer += (steerTarget - physics.steer) * Math.min(1, STEER_SMOOTH * dt);

    var wheelieInput = (input.forward && input.back) || input.trick;
    var throttle = (input.forward && input.back) ? 1 : (input.forward ? 1 : (input.back ? -1 : 0));
    physics.throttle = throttle;

    if (brakeLightMat) {
      brakeLightMat.color.setHex(input.back && !input.forward ? 0xffbe0b : 0xff3b30);
    }

    // Turbo activo también en el aire si se mantiene apretado
    var turboActive = false;
    if (input.turbo && physics.turbo > 0.04 && (throttle > 0 || physics.airborne)) {
      turboActive = true;
      physics.turbo = Math.max(0, physics.turbo - 0.52 * dt);
    } else {
      physics.turbo = Math.min(1, physics.turbo + 0.30 * dt);
    }
    physics.turboActive = turboActive;

    if (physics.airborne) {
      if (wheelieInput) physics.trickRotation += TRICK_SPIN_RATE * dt;
      var airSpeedRatio = THREE.MathUtils.clamp(Math.abs(physics.speed) / 8, 0, 1);
      physics.heading += physics.steer * TURN_RATE * 0.65 * airSpeedRatio * dt * (physics.speed < 0 ? -1 : 1);
      physics.x += Math.sin(physics.heading) * physics.speed * dt;
      physics.z += Math.cos(physics.heading) * physics.speed * dt;
      var rAir = Math.hypot(physics.x, physics.z);
      if (rAir > PD.WORLD_R - 2) {
        var kk = (PD.WORLD_R - 2) / rAir;
        physics.x *= kk; physics.z *= kk;
      }
      physics.onRoute = WB.isOnRoute(physics.x, physics.z);
      physics.wheelie = Math.max(0, physics.wheelie - dt * 2.5);
      return;
    }

    var onRoute = WB.isOnRoute(physics.x, physics.z);
    physics.onRoute = onRoute;

    var maxSpeed = B.maxSpeed * (turboActive ? B.turboMult : 1) * (onRoute ? ROUTE_BOOST : 1);

    var s = WB.slopeAt(physics.x, physics.z);
    var fx = Math.sin(physics.heading), fz = Math.cos(physics.heading);
    var slopeAlong = s.dx * fx + s.dz * fz;
    var slopeFactor = THREE.MathUtils.clamp(1 - (slopeAlong * 0.22) / B.climb, 0.8, 1.35);

    if (throttle > 0) {
      physics.speed += B.accel * slopeFactor * (turboActive ? 1.48 : 1) * (onRoute ? 1.2 : 1) * dt;
    } else if (throttle < 0) {
      if (physics.speed > 0.3) physics.speed -= 34 * dt;
      else physics.speed -= B.accel * 0.6 * dt;
    } else {
      var fr = FRICTION * (1 + Math.max(0, -slopeAlong) * 0.4);
      if (physics.speed > 0) physics.speed = Math.max(0, physics.speed - fr * dt);
      else physics.speed = Math.min(0, physics.speed + fr * dt);
    }
    physics.speed += -slopeAlong * (throttle > 0 ? 1.0 : 3.5) * dt;
    physics.speed = THREE.MathUtils.clamp(physics.speed, MAX_REV, maxSpeed);

    var speedRatio = THREE.MathUtils.clamp(Math.abs(physics.speed) / 7.5, 0, 1);
    // Agarre progresivo para doblar con precisión tanto a baja como a alta velocidad
    var highSpeedGrip = 1.0 - THREE.MathUtils.clamp((Math.abs(physics.speed) - 24) / 45, 0, 0.22);
    physics.heading += physics.steer * TURN_RATE * speedRatio * highSpeedGrip * dt * (physics.speed < 0 ? -1 : 1);

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
    // Dinámica de suspensión (resorte + amortiguador)
    physics.suspVel += (-physics.suspOffset * 48 - physics.suspVel * 10) * dt;
    physics.suspOffset = THREE.MathUtils.clamp(physics.suspOffset + physics.suspVel * dt, -0.18, 0.14);

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
      physics.pitch += (THREE.MathUtils.clamp(-physics.yVel * 0.025, -0.35, 0.35) - physics.pitch) * Math.min(1, 5 * dt);
    } else {
      var fS = WB.slopeAt(physics.x + Math.sin(physics.heading) * 0.95, physics.z + Math.cos(physics.heading) * 0.95);
      var rS = WB.slopeAt(physics.x - Math.sin(physics.heading) * 0.75, physics.z - Math.cos(physics.heading) * 0.75);
      var groundH = groundSurfaceHeight(physics.x, physics.z);
      var targetY = groundH + B.baseOffset + physics.suspOffset;
      physics.y += (targetY - physics.y) * Math.min(1, 22 * dt);
      var turboPitch = physics.turboActive ? -0.05 : 0;
      var targetPitch = THREE.MathUtils.clamp(Math.atan2(rS.h - fS.h, 1.7), -0.45, 0.45) - physics.wheelie * 0.48 + turboPitch;
      physics.pitch += (targetPitch - physics.pitch) * Math.min(1, 12 * dt);
    }

    bike.position.set(physics.x, physics.y, physics.z);

    var targetRoll = physics.airborne
      ? physics.roll * 0.9
      : (-physics.steer * 0.42 * B.lean * THREE.MathUtils.clamp(Math.abs(physics.speed) / 13, 0, 1));
    physics.roll += (targetRoll - physics.roll) * Math.min(1, 7.5 * dt);

    var visualPitch = physics.airborne ? (physics.pitch + physics.trickRotation) : physics.pitch;
    bike.rotation.order = 'YXZ';
    bike.rotation.set(visualPitch, physics.heading, physics.roll);

    var wheelSpin = physics.speed * dt / 0.38;
    bike.userData.frontWheel.rotation.x -= wheelSpin;
    bike.userData.rearWheel.rotation.x -= wheelSpin;

    // Animar postura del piloto (inclinación en curvas + agachado aerodinámico con el Turbo)
    if (riderGroup) {
      var leanIn = -physics.steer * 0.22 * THREE.MathUtils.clamp(Math.abs(physics.speed) / 10, 0, 1);
      riderGroup.rotation.z += (leanIn - riderGroup.rotation.z) * Math.min(1, 10 * dt);
      riderGroup.position.x += (-leanIn * 0.25 - riderGroup.position.x) * Math.min(1, 10 * dt);
      if (riderTorso && riderHead) {
        var tuck = physics.turboActive ? 0.76 : (0.52 - physics.wheelie * 0.18);
        riderTorso.rotation.x += (tuck - riderTorso.rotation.x) * Math.min(1, 9 * dt);
        riderHead.position.z += ((physics.turboActive ? 0.32 : 0.24) - riderHead.position.z) * Math.min(1, 9 * dt);
      }
    }

    // Animar la bufanda del piloto con el viento y el turbo
    var now = performance.now() * 0.008;
    var windFactor = 0.25 + THREE.MathUtils.clamp(Math.abs(physics.speed) / 22, 0, 1.2) * (physics.turboActive ? 1.35 : 0.85);
    for (var si = 0; si < scarfNodes.length; si++) {
      var sn = scarfNodes[si];
      sn.rotation.x = 0.18 * windFactor + Math.sin(now * 2.5 - si * 0.9) * 0.15 * windFactor;
      sn.rotation.y = -physics.steer * 0.18 + Math.cos(now * 1.9 - si * 0.8) * 0.13 * windFactor;
    }

    // Animar LLAMAS DE FUEGO 3D y chispas en ambos escapes cuando el Turbo está activo
    if (physics.turboActive) {
      bike.updateMatrixWorld();
      var pulse = 0.82 + Math.random() * 0.45;
      for (var ei = 0; ei < exhaustNozzles.length; ei++) {
        var noz = exhaustNozzles[ei];
        noz.flamePivot.visible = true;
        var fScaleZ = 0.85 + Math.random() * 0.65;
        var fScaleXY = 0.88 + Math.random() * 0.32;
        noz.flamePivot.scale.set(fScaleXY, fScaleXY, fScaleZ);
        noz.coreCone.rotation.z = Math.random() * Math.PI;
        noz.outerCone.rotation.z = -Math.random() * Math.PI;

        var tipWorld = noz.localTip.clone().applyMatrix4(bike.matrixWorld);
        spawnTurboFlameParticle(tipWorld, physics.heading);
      }
      if (turboFlameLight) {
        turboFlameLight.intensity = 2.4 * pulse;
      }
    } else {
      for (var ei2 = 0; ei2 < exhaustNozzles.length; ei2++) {
        exhaustNozzles[ei2].flamePivot.visible = false;
      }
      if (turboFlameLight) {
        turboFlameLight.intensity = 0;
      }
    }

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

    // Actualizar estela de fuego del Turbo
    for (var fi = 0; fi < flamePool.length; fi++) {
      var fspr = flamePool[fi];
      if (fspr.userData.life > 0) {
        fspr.userData.life -= dt;
        var ft = 1 - fspr.userData.life / fspr.userData.maxLife;
        fspr.position.x += fspr.userData.vx * dt;
        fspr.position.y += fspr.userData.vy * dt;
        fspr.position.z += fspr.userData.vz * dt;
        var fsc = 0.24 + ft * 0.52;
        fspr.scale.set(fsc, fsc, 1);
        fspr.material.opacity = Math.max(0, (1 - ft) * 0.92);
      } else {
        fspr.material.opacity = 0;
      }
    }

    for (var j = 0; j < skidPool.length; j++) {
      var sk = skidPool[j];
      if (sk.life > 0) {
        sk.life -= dt;
        sk.mesh.material.opacity = Math.max(0, 0.65 * Math.min(1, sk.life / 1.5));
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
    physics.pitch = THREE.MathUtils.clamp(Math.atan2(rS.h - fS.h, 1.7), -0.45, 0.45);
    if (bike) {
      bike.position.set(physics.x, physics.y, physics.z);
      bike.rotation.order = 'YXZ';
      bike.rotation.set(physics.pitch, physics.heading, 0);
    }
  }

  function resetPhysics() {
    physics.speed = 0; physics.steer = 0; physics.pitch = 0; physics.roll = 0; physics.turbo = 1;
    physics.turboActive = false; physics.throttle = 0;
    physics.airborne = false; physics.yVel = 0; physics.airTime = 0; physics.trickRotation = 0;
    physics.driftAccum = 0; physics.wheelie = 0; physics.wheelieAccum = 0;
    physics.climbSlope = 0; physics.jumpCooldown = 0;
    physics.suspOffset = 0; physics.suspVel = 0;
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
