// World Builder: Studio Ghibli Aesthetic Terrain, 2 Gentle Lomitas, Seamless Road, Stations & Lush Foliage
window.WorldBuilder = (function() {
  'use strict';

  var PD = window.PortfolioData;
  var WORLD_R = PD.WORLD_R;
  var CIRCUIT_RADIUS = PD.CIRCUIT_RADIUS;
  var STATION_RADIUS = PD.STATION_RADIUS;
  var ROUTE_WIDTH = PD.ROUTE_WIDTH;
  var SIGN_COLOR = PD.SIGN_COLOR;

  var OBSTACLES = [];
  var ROUTES = [];
  var PLATFORMS = [];
  var RAMPS = [];
  var STATIONS = [];
  var TREE_SPAWN_POINTS = [];
  var billboardGroups = [];
  var TRICK_SIGN_POS = null;

  // Solo DOS lomitas suaves en todo el circuito para hacer un salto chico y divertido sin perder el control
  var ROUTE_LOMAS = [
    { angle: Math.PI * 0.52, height: 2.0, halfW: 0.22 },
    { angle: Math.PI * 1.52, height: 2.2, halfW: 0.23 }
  ];

  function angleDiff(a, b) {
    var d = (a - b) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function lomaHeightAtAngle(ang) {
    var h = 0;
    for (var i = 0; i < ROUTE_LOMAS.length; i++) {
      var lm = ROUTE_LOMAS[i];
      var da = Math.abs(angleDiff(ang, lm.angle));
      if (da < lm.halfW) {
        var u = 0.5 * (1 + Math.cos(Math.PI * (da / lm.halfW)));
        h += lm.height * (u * u);
      }
    }
    return h;
  }

  function rawHeightAt(x, z) {
    var r = Math.sqrt(x * x + z * z);
    var mountain = Math.pow(Math.max(0, (r - 56)) * 0.052, 1.55);
    var n1 = Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.04) * 1.4;
    var n2 = Math.sin(x * 0.09 - z * 0.08) * 0.55;
    var n3 = Math.sin((x + z) * 0.022) * 2.1;
    return mountain * 4.8 + n3 * (0.25 + mountain * 0.1) + n1 + n2;
  }

  // En la ruta mantenemos el camino súper suave y manejable, con solo las 2 lomitas suaves
  function roadCenterHeightAtAngle(ang) {
    var cx = Math.sin(ang) * CIRCUIT_RADIUS;
    var cz = Math.cos(ang) * CIRCUIT_RADIUS;
    return rawHeightAt(cx, cz) * 0.38 + lomaHeightAtAngle(ang);
  }

  function heightAt(x, z) {
    var r = Math.sqrt(x * x + z * z);
    var hNat = rawHeightAt(x, z);
    var distRoad = Math.abs(r - CIRCUIT_RADIUS);
    if (distRoad >= 12.0 || r < 5) return hNat;
    var ang = Math.atan2(x, z);
    var hRoad = roadCenterHeightAtAngle(ang);
    if (distRoad <= 3.6) return hRoad;
    var t = (distRoad - 3.6) / (12.0 - 3.6);
    var s = t * t * (3 - 2 * t);
    return hRoad * (1 - s) + hNat * s;
  }

  // Trinchera bajo el asfalto para que jamás asome un triángulo del terreno en la ruta
  function terrainMeshHeightAt(x, z) {
    var h = heightAt(x, z);
    var r = Math.sqrt(x * x + z * z);
    var distRoad = Math.abs(r - CIRCUIT_RADIUS);
    if (distRoad < 3.3) {
      var u = Math.max(0, (distRoad - 2.3) / 1.0);
      var s = u * u * (3 - 2 * u);
      h -= 0.45 * (1 - s);
    }
    return h;
  }

  function slopeAt(x, z) {
    var e = 0.5;
    var h0 = heightAt(x, z);
    return {
      dx: (heightAt(x + e, z) - h0) / e,
      dz: (heightAt(x, z + e) - h0) / e,
      h: h0
    };
  }

  // Paleta de colores estilo Studio Ghibli (praderas verdes vibrantes, tierra cálida, roca azulada y nieve cálida)
  function colorForHeight(h, x, z) {
    var snow = new THREE.Color(0xfbf8f1);
    var rock = new THREE.Color(0x6c7a89);
    var dirt = new THREE.Color(0xb08968);
    var grassLight = new THREE.Color(0x7ec850);
    var grassLush = new THREE.Color(0x52a549);
    var grassDeep = new THREE.Color(0x3b8544);

    var meadowWave = Math.sin(x * 0.06 + z * 0.05) * 0.5 + 0.5;
    var grass = grassLush.clone().lerp(grassLight, meadowWave * 0.65).lerp(grassDeep, (1 - meadowWave) * 0.3);

    if (h < 2.2) return grass;
    if (h < 5.8) return grass.clone().lerp(dirt, (h - 2.2) / 3.6);
    if (h < 13.5) return dirt.clone().lerp(rock, (h - 5.8) / 7.7);
    return rock.clone().lerp(snow, Math.min(1, (h - 13.5) / 7.5));
  }

  // Terreno indexado con normales suavizadas para un acabado orgánico estilo pintura Ghibli
  function buildTerrain(scene, toonGrad) {
    var seg = 180;
    var size = WORLD_R * 2 + 10;
    var half = size / 2;
    var step = size / seg;
    var vertCount = (seg + 1) * (seg + 1);
    var positions = new Float32Array(vertCount * 3);
    var colors = new Float32Array(vertCount * 3);
    var indices = [];

    var ptr = 0;
    for (var i = 0; i <= seg; i++) {
      var x = -half + i * step;
      for (var j = 0; j <= seg; j++) {
        var z = -half + j * step;
        var h = terrainMeshHeightAt(x, z);
        var c = colorForHeight(h, x, z);
        positions[ptr] = x;
        positions[ptr + 1] = h;
        positions[ptr + 2] = z;
        colors[ptr] = c.r;
        colors[ptr + 1] = c.g;
        colors[ptr + 2] = c.b;
        ptr += 3;
      }
    }

    var row = seg + 1;
    for (var ii = 0; ii < seg; ii++) {
      for (var jj = 0; jj < seg; jj++) {
        var a = ii * row + jj;
        var b = a + 1;
        var cIdx = (ii + 1) * row + jj + 1;
        var d = (ii + 1) * row + jj;
        indices.push(a, b, cIdx, a, cIdx, d);
      }
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    var mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGrad });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // Textura de ruta de alta definición estilo anime con bordes blancos y línea central cálida
  function makeRouteTexture(colorHex) {
    var w = 128, h = 256;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');

    // Base asfalto cálido
    ctx.fillStyle = '#484d56';
    ctx.fillRect(0, 0, w, h);

    // Textura sutil de camino pintado
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (var i = 0; i < 180; i++) {
      var rx = (Math.sin(i * 73.1) * 0.5 + 0.5) * w;
      var ry = (Math.cos(i * 39.7) * 0.5 + 0.5) * h;
      ctx.fillRect(rx, ry, 3, 10);
    }

    // Bordes de banquina cálidos y líneas blancas laterales
    ctx.fillStyle = '#9e8c70';
    ctx.fillRect(0, 0, 5, h);
    ctx.fillRect(w - 5, 0, 5, h);

    ctx.fillStyle = '#f4f1de';
    ctx.fillRect(7, 0, 4, h);
    ctx.fillRect(w - 11, 0, 4, h);

    // Línea central discontinua dorada
    ctx.fillStyle = window.hexStr(colorHex);
    for (var y2 = 12; y2 < h; y2 += 64) {
      ctx.fillRect(w / 2 - 3, y2, 6, 34);
    }

    var tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function buildCircuitRoad(scene, toonGrad, colorHex) {
    var SEGMENTS = 420;
    var hw = 2.85;
    var positions = [], uvs = [], idx = [], pts = [];
    var circumference = 2 * Math.PI * CIRCUIT_RADIUS;
    var totalV = Math.round(circumference * 0.22);

    for (var i = 0; i <= SEGMENTS; i++) {
      var wrappedIdx = i % SEGMENTS;
      var angle = (wrappedIdx / SEGMENTS) * Math.PI * 2;
      var sinA = Math.sin(angle);
      var cosA = Math.cos(angle);

      var cx = sinA * CIRCUIT_RADIUS;
      var cz = cosA * CIRCUIT_RADIUS;
      var yRoad = roadCenterHeightAtAngle(angle) + 0.025;

      pts.push(new THREE.Vector3(cx, yRoad, cz));

      var lx = sinA * (CIRCUIT_RADIUS + hw);
      var lz = cosA * (CIRCUIT_RADIUS + hw);
      var rx = sinA * (CIRCUIT_RADIUS - hw);
      var rz = cosA * (CIRCUIT_RADIUS - hw);

      positions.push(lx, yRoad, lz, rx, yRoad, rz);
      var v = (i / SEGMENTS) * totalV;
      uvs.push(0, v, 1, v);
    }

    for (var i2 = 0; i2 < SEGMENTS; i2++) {
      var a = i2 * 2, b = i2 * 2 + 1, c = i2 * 2 + 2, d = i2 * 2 + 3;
      idx.push(a, b, c, b, d, c);
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    var tex = makeRouteTexture(colorHex);
    var mat = new THREE.MeshToonMaterial({
      map: tex,
      gradientMap: toonGrad,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    scene.add(mesh);

    ROUTES.push({ points: pts, mesh: mesh, tex: tex });
  }

  function nearRoute(x, z, margin) {
    var r = Math.hypot(x, z);
    return Math.abs(r - CIRCUIT_RADIUS) < margin;
  }

  function isOnRoute(px, pz) {
    var r = Math.hypot(px, pz);
    return Math.abs(r - CIRCUIT_RADIUS) < ROUTE_WIDTH;
  }

  function makeLabelSprite(text, hexColor) {
    var size = 256;
    var cnv = document.createElement('canvas');
    cnv.width = cnv.height = size;
    var ctx = cnv.getContext('2d');
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 10, 0, Math.PI * 2);
    ctx.fillStyle = hexColor;
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#fffdf7';
    ctx.stroke();
    ctx.fillStyle = '#1b1410';
    ctx.font = 'bold 118px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2 + 8);
    var tex = new THREE.CanvasTexture(cnv);
    var mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    var spr = new THREE.Sprite(mat);
    spr.scale.set(3.0, 3.0, 1);
    return spr;
  }

  function makeFacadeTexture(accentHex) {
    var w = 64, h = 160;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#e8dfd1';
    ctx.fillRect(0, 0, w, h);
    for (var row = 6; row < h - 6; row += 12) {
      for (var col = 6; col < w - 8; col += 12) {
        var lit = Math.sin(row * 13 + col * 7) > -0.2;
        ctx.fillStyle = lit ? '#ffe6a3' : '#4a5d73';
        ctx.fillRect(col, row, 7, 8);
      }
    }
    ctx.fillStyle = accentHex;
    ctx.fillRect(w - 8, 0, 5, h);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  function makeSignTexture(text, accentHex) {
    var w = 320, h = 80;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#261e18';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = accentHex;
    ctx.fillRect(0, h - 7, w, 7);
    ctx.fillStyle = '#fdf8ee';
    ctx.font = 'bold 38px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), w / 2, h / 2 - 3);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  function buildStationSign(scene, toonMat, center, text, colorHex, dz) {
    var group = new THREE.Group();
    var signX = center.x, signZ = center.z + (dz || 6.5);
    var h = heightAt(signX, signZ);
    group.position.set(signX, h, signZ);
    var postMat = toonMat(0x5c4028);
    var post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 3.8, 8), postMat);
    post1.position.set(-2.0, 1.9, 0);
    post1.castShadow = true;
    group.add(post1);
    var post2 = post1.clone();
    post2.position.x = 2.0;
    group.add(post2);
    var bannerTex = makeSignTexture(text, colorHex);
    var banner = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 1.05),
      new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide })
    );
    banner.position.set(0, 3.4, 0);
    banner.rotation.y = Math.PI;
    group.add(banner);
    scene.add(group);
  }

  function makeCrossTexture() {
    var c = document.createElement('canvas');
    c.width = c.height = 32;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#e03e36';
    ctx.fillRect(12, 3, 8, 26);
    ctx.fillRect(3, 12, 26, 8);
    return new THREE.CanvasTexture(c);
  }

  function buildStations(scene, toonGrad, toonMat) {
    STATIONS = [0, 1, 2, 3, 4].map(function(i) {
      var angle = (i / 5) * Math.PI * 2;
      var x = Math.sin(angle) * STATION_RADIUS;
      var z = Math.cos(angle) * STATION_RADIUS;
      var c = PD.STATION_CONTENT[i];
      return {
        id: i,
        pos: new THREE.Vector3(x, heightAt(x, z), z),
        title: c.title,
        eyebrow: c.eyebrow,
        desc: c.desc,
        link: c.link,
        color: PD.STATION_COLORS[i],
        dismissed: false
      };
    });

    STATIONS.forEach(function(st) {
      if (st.id === 0) {
        var group = new THREE.Group();
        group.position.set(st.pos.x, st.pos.y, st.pos.z);
        OBSTACLES.push({ x: st.pos.x, z: st.pos.z, r: 4.2 });
        var accentHex = window.hexStr(st.color);
        var facadeMat = new THREE.MeshToonMaterial({ map: makeFacadeTexture(accentHex), gradientMap: toonGrad });
        var trimMat = toonMat(0x3f4756);
        var baseMat = toonMat(0x8d7b68);

        var podium = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.6, 6.4), baseMat);
        podium.position.y = 1.3; podium.castShadow = true; podium.receiveShadow = true;
        group.add(podium);
        var canopy = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 2), trimMat);
        canopy.position.set(0, 2.8, 2.6); canopy.castShadow = true;
        group.add(canopy);
        var door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2, 0.1), new THREE.MeshToonMaterial({ color: 0x202327, gradientMap: toonGrad, emissive: 0xffe099, emissiveIntensity: 0.35 }));
        door.position.set(0, 1.4, 3.25);
        group.add(door);

        var shaftH = 19;
        var shaft = new THREE.Mesh(new THREE.BoxGeometry(4.6, shaftH, 4.6), facadeMat);
        shaft.position.y = 2.6 + shaftH / 2; shaft.castShadow = true; shaft.receiveShadow = true;
        group.add(shaft);

        var upperH = 7;
        var upperMat = new THREE.MeshToonMaterial({ map: makeFacadeTexture(accentHex), gradientMap: toonGrad });
        var upper = new THREE.Mesh(new THREE.BoxGeometry(3.3, upperH, 3.3), upperMat);
        upper.position.y = 2.6 + shaftH + upperH / 2; upper.castShadow = true;
        group.add(upper);

        var ledge = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.3, 3.7), trimMat);
        ledge.position.y = 2.6 + shaftH + upperH + 0.15;
        group.add(ledge);
        var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 8), trimMat);
        mast.position.y = 2.6 + shaftH + upperH + 1.5;
        group.add(mast);

        var sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: makeSignTexture(st.title, SIGN_COLOR) }));
        sign.position.set(0, 2.6 + shaftH * 0.78, 2.32);
        group.add(sign);

        var beamMat = new THREE.MeshBasicMaterial({ color: st.color, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false });
        var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.02, 7, 12, 1, true), beamMat);
        beam.position.y = 2.6 + shaftH + upperH + 3.5;
        group.add(beam);
        var label = makeLabelSprite('1', accentHex);
        label.position.y = 2.6 + shaftH + upperH + 4.6;
        group.add(label);

        scene.add(group);
        st.marker = group;
        st.flag = label;
      } else {
        var fGroup = new THREE.Group();
        fGroup.position.copy(st.pos);
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 8), toonMat(0x5c4028));
        pole.position.y = 2.5; pole.castShadow = true;
        fGroup.add(pole);
        var flag = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.5, 12, 1, true), toonMat(st.color, { emissive: st.color, emissiveIntensity: 0.3 }));
        flag.position.y = 5.5; flag.rotation.x = Math.PI;
        fGroup.add(flag);
        var beamMat2 = new THREE.MeshBasicMaterial({ color: st.color, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
        var beam2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.02, 9, 12, 1, true), beamMat2);
        beam2.position.y = 5.4;
        fGroup.add(beam2);
        var label2 = makeLabelSprite(String(st.id + 1), window.hexStr(st.color));
        label2.position.y = 7.2;
        fGroup.add(label2);
        scene.add(fGroup);
        st.marker = fGroup;
        st.flag = flag;

        var pGroup = new THREE.Group();
        pGroup.position.copy(st.pos);
        var darkMat = toonMat(0x3b4252);
        var greyMat = toonMat(0x9aa5b1);
        var rustMat = toonMat(0xc86d51);
        var crateMat = toonMat(0xc99e5a);

        if (st.id === 1) {
          OBSTACLES.push({ x: st.pos.x + 4.2, z: st.pos.z, r: 5.0 });
          var wallMat = toonMat(0xede0d4);
          var body = new THREE.Mesh(new THREE.BoxGeometry(8.5, 5.2, 6.5), wallMat);
          body.position.set(4.2, 2.6, 0); body.castShadow = true; body.receiveShadow = true;
          pGroup.add(body);
          var roofCap = new THREE.Mesh(new THREE.BoxGeometry(8.9, 0.35, 6.9), toonMat(0xb5533c));
          roofCap.position.set(4.2, 5.3, 0); pGroup.add(roofCap);
          var canopy2 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.25, 2.4), darkMat);
          canopy2.position.set(0.3, 4.0, 0); canopy2.castShadow = true; pGroup.add(canopy2);
          var door2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.4, 3.2), new THREE.MeshToonMaterial({ color: 0x202327, gradientMap: toonGrad, emissive: 0x3a4654, emissiveIntensity: 0.35 }));
          door2.position.set(-0.05, 1.9, 0); pGroup.add(door2);
          var crateSpots = [[-2.6, -2.6], [-1.7, -2.6], [-2.6, -1.7], [-3.4, -2.1]];
          crateSpots.forEach(function(p, idxC) {
            var crate = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), crateMat);
            crate.position.set(p[0], 0.5, p[1]); crate.rotation.y = idxC * 0.4; crate.castShadow = true;
            pGroup.add(crate);
          });
          buildStationSign(scene, toonMat, st.pos, 'Almacén de Logística', SIGN_COLOR, 7.5);
        } else if (st.id === 2) {
          OBSTACLES.push({ x: st.pos.x - 1.6, z: st.pos.z - 1.4, r: 1.3 });
          var rack = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.6, 1.1), darkMat);
          rack.position.set(-1.6, 1.3, -1.4); rack.castShadow = true;
          pGroup.add(rack);
          for (var li = 0; li < 5; li++) {
            var light = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.07), toonMat(li % 2 ? 0x52b788 : 0xff9f1c, { emissive: li % 2 ? 0x52b788 : 0xff9f1c, emissiveIntensity: 0.6 }));
            light.position.set(-1.6, 0.5 + li * 0.45, -0.95); pGroup.add(light);
          }
          var rack2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.8), darkMat);
          rack2.position.set(2.0, 0.8, 1.3); rack2.castShadow = true; pGroup.add(rack2);
        } else if (st.id === 3) {
          OBSTACLES.push({ x: st.pos.x - 3.0, z: st.pos.z + 0.8, r: 3.2 });
          var tank = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 5.6, 20), greyMat);
          tank.position.set(-3, 2.8, 0.8); tank.castShadow = true; tank.receiveShadow = true;
          pGroup.add(tank);
          var cap = new THREE.Mesh(new THREE.ConeGeometry(2.35, 1.0, 20), rustMat);
          cap.position.set(-3, 5.8, 0.8); pGroup.add(cap);
          var tank2 = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 3.4, 18), greyMat);
          tank2.position.set(1.0, 1.7, 2.2); tank2.castShadow = true; pGroup.add(tank2);
          buildStationSign(scene, toonMat, st.pos, 'Planta Petrolera', SIGN_COLOR, 7.5);
        } else if (st.id === 4) {
          OBSTACLES.push({ x: st.pos.x, z: st.pos.z - 1.6, r: 2.6 });
          var baseTent = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.9, 4.2), toonMat(0xfdf8ee));
          baseTent.position.set(0, 0.95, -1.6); baseTent.castShadow = true; baseTent.receiveShadow = true;
          pGroup.add(baseTent);
          var roofMat = toonMat(0xe0533c);
          var roof1 = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.16, 3.0), roofMat);
          roof1.position.set(0, 2.3, -2.3); roof1.rotation.x = 0.55; roof1.castShadow = true;
          pGroup.add(roof1);
          var roof2 = roof1.clone(); roof2.position.z = -0.9; roof2.rotation.x = -0.55;
          pGroup.add(roof2);
          var crossTex = makeCrossTexture();
          var cross = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshBasicMaterial({ map: crossTex }));
          cross.position.set(0, 1.7, -1.58); pGroup.add(cross);
          buildStationSign(scene, toonMat, st.pos, 'Campo de Médicos', SIGN_COLOR, 7.5);
        }
        scene.add(pGroup);
      }
    });

    buildFinishLineArch(scene, toonMat);
  }

  var FINISH_LINE = null;

  function makeFinishBannerTexture() {
    var w = 512, h = 128;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');

    ctx.fillStyle = '#1b2620';
    ctx.fillRect(0, 0, w, h);

    // Franja superior e inferior a cuadros blanco/dorado estilo Meta
    var sq = 16;
    for (var x = 0; x < w; x += sq) {
      var isEven = ((x / sq) % 2) === 0;
      ctx.fillStyle = isEven ? '#fdf8ee' : '#f59e0b';
      ctx.fillRect(x, 0, sq, 16);
      ctx.fillStyle = isEven ? '#f59e0b' : '#fdf8ee';
      ctx.fillRect(x, h - 16, sq, 16);
    }

    ctx.fillStyle = '#fcd34d';
    ctx.font = 'bold 34px Quicksand, Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏁 META · AGENDAR REUNIÓN', w / 2, h / 2 - 10);

    ctx.fillStyle = '#fdf8ee';
    ctx.font = '600 20px Quicksand, Inter, sans-serif';
    ctx.fillText('CONECTAR CON GOOGLE CALENDAR DE PEDRO', w / 2, h / 2 + 22);

    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  function makeCheckeredStripTexture() {
    var w = 256, h = 64;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    var sq = 16;
    for (var y = 0; y < h; y += sq) {
      for (var x = 0; x < w; x += sq) {
        var even = (((x / sq) + (y / sq)) % 2) === 0;
        ctx.fillStyle = even ? '#fdf8ee' : '#1e242b';
        ctx.fillRect(x, y, sq, sq);
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  // Arco de Meta 3D estilo Studio Ghibli al final del circuito
  function buildFinishLineArch(scene, toonMat) {
    var finishAngle = Math.PI * 1.84;
    var fx = Math.sin(finishAngle) * CIRCUIT_RADIUS;
    var fz = Math.cos(finishAngle) * CIRCUIT_RADIUS;
    var fy = roadCenterHeightAtAngle(finishAngle);

    // Orientación tangente a la ruta en ese punto
    var tangentYaw = finishAngle + Math.PI / 2;

    var archGroup = new THREE.Group();
    archGroup.position.set(fx, fy, fz);
    archGroup.rotation.y = tangentYaw;

    var woodRedMat = toonMat(0xc83e31);
    var darkWoodMat = toonMat(0x4a3525);
    var stoneMat = toonMat(0x8a95a5);
    var goldMat = toonMat(0xf59e0b, { emissive: 0xf59e0b, emissiveIntensity: 0.25 });

    // Columnas laterales fuera del asfalto (a +/- 3.65m del centro de la ruta)
    [-3.65, 3.65].forEach(function(sideX) {
      var basePedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.9, 12), stoneMat);
      basePedestal.position.set(sideX, 0.45, 0);
      basePedestal.castShadow = true;
      archGroup.add(basePedestal);

      var pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.30, 5.6, 14), woodRedMat);
      pillar.position.set(sideX, 3.2, 0);
      pillar.castShadow = true;
      archGroup.add(pillar);

      // Farol japonés / Ghibli cálido colgando a cada lado
      var lantern = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xffe599 })
      );
      lantern.scale.set(0.85, 1.25, 0.85);
      lantern.position.set(sideX * 0.78, 4.4, 0);
      archGroup.add(lantern);
    });

    // Vigas superiores estilo Torii / Ghibli
    var topBeam = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.42, 0.55), darkWoodMat);
    topBeam.position.set(0, 6.05, 0);
    topBeam.castShadow = true;
    archGroup.add(topBeam);

    var subBeam = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.28, 0.42), woodRedMat);
    subBeam.position.set(0, 5.2, 0);
    archGroup.add(subBeam);

    // Cartel principal de Meta doble faz
    var bannerTex = makeFinishBannerTexture();
    var bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide });
    var bannerMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 1.65), bannerMat);
    bannerMesh.position.set(0, 5.62, 0.3);
    archGroup.add(bannerMesh);

    var bannerBack = bannerMesh.clone();
    bannerBack.position.z = -0.3;
    bannerBack.rotation.y = Math.PI;
    archGroup.add(bannerBack);

    // Línea de llegada a cuadros sobre el asfalto
    var stripTex = makeCheckeredStripTexture();
    var stripMat = new THREE.MeshBasicMaterial({
      map: stripTex,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4
    });
    var stripMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.35), stripMat);
    stripMesh.rotation.x = -Math.PI / 2;
    stripMesh.position.set(0, 0.05, 0);
    archGroup.add(stripMesh);

    // Haz de luz dorado vertical y emblema flotante "META"
    var beamMat = new THREE.MeshBasicMaterial({
      color: 0xfcd34d,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.05, 11, 14, 1, true), beamMat);
    beam.position.set(0, 6.5, 0);
    archGroup.add(beam);

    var badge = makeLabelSprite('🏁', '#f59e0b');
    badge.position.set(0, 8.2, 0);
    archGroup.add(badge);

    var finishStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), goldMat);
    finishStar.position.set(0, 6.8, 0);
    archGroup.add(finishStar);

    scene.add(archGroup);

    // Agregar colisión solo a los dos pilares laterales para que el centro sea 100% transitable
    var cosT = Math.cos(tangentYaw), sinT = Math.sin(tangentYaw);
    [-3.65, 3.65].forEach(function(sx) {
      OBSTACLES.push({
        x: fx + sx * cosT,
        z: fz - sx * sinT,
        r: 0.55
      });
    });

    FINISH_LINE = {
      pos: new THREE.Vector3(fx, fy, fz),
      angle: finishAngle,
      group: archGroup,
      star: finishStar,
      dismissed: false
    };
  }

  function addRailPlatform(cx, cz, heading, totalLength, rampLen, width, height) {
    PLATFORMS.push({
      cx: cx, cz: cz, sin: Math.sin(heading), cos: Math.cos(heading),
      halfLen: totalLength / 2, halfWid: width / 2, rampLen: rampLen, height: height,
      baseH: heightAt(cx, cz)
    });
  }

  function platformHeightAt(x, z) {
    var best = null;
    for (var i = 0; i < PLATFORMS.length; i++) {
      var p = PLATFORMS[i];
      var dx = x - p.cx, dz = z - p.cz;
      var along = dx * p.sin + dz * p.cos;
      var across = dx * p.cos - dz * p.sin;
      if (Math.abs(across) > p.halfWid) continue;
      var totalLength = p.halfLen * 2;
      var distFromStart = along + p.halfLen;
      if (distFromStart < 0 || distFromStart > totalLength) continue;
      var h;
      if (distFromStart < p.rampLen) {
        h = p.height * (distFromStart / p.rampLen);
      } else if (distFromStart > totalLength - p.rampLen) {
        h = p.height * ((totalLength - distFromStart) / p.rampLen);
      } else {
        h = p.height;
      }
      var worldH = p.baseH + h;
      if (best === null || worldH > best) best = worldH;
    }
    return best;
  }

  function buildTrickPark(scene, toonMat) {
    function buildRamp(x, z, heading, power) {
      var h = heightAt(x, z);
      var group = new THREE.Group();
      group.position.set(x, h, z);
      group.rotation.y = heading;
      var rampMat = toonMat(0xb07d4f);
      var deck = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.4, 7), rampMat);
      deck.rotation.x = -0.36;
      deck.position.set(0, 1.15, 0.5);
      deck.castShadow = true; deck.receiveShadow = true;
      group.add(deck);
      scene.add(group);
      RAMPS.push({ pos: new THREE.Vector3(x, h, z), heading: heading, power: power || 0.9 });
    }

    var angle = (0.5 / 5) * Math.PI * 2;
    var radius = 64;
    var tp = { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius };
    var rampX = tp.x - 8, rampZ = tp.z - 2;
    var rampHeading = Math.atan2(tp.x - rampX, tp.z - rampZ);
    buildRamp(rampX, rampZ, rampHeading, 0.95);
    var signCenter = { x: tp.x, z: tp.z - 10 };
    buildStationSign(scene, toonMat, signCenter, 'Zona de Trucos', SIGN_COLOR, 0);
    TRICK_SIGN_POS = { x: signCenter.x, z: signCenter.z };
  }

  function makeInstancedPart(scene, geo, mat, transforms, castShadow) {
    var mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, transforms.length));
    mesh.count = transforms.length;
    var dummy = new THREE.Object3D();
    for (var i = 0; i < transforms.length; i++) {
      var t = transforms[i];
      dummy.position.set(t.x, t.y, t.z);
      dummy.rotation.set(0, t.ry || 0, 0);
      dummy.scale.setScalar(t.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.castShadow = castShadow !== false;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  // Árboles frondosos estilo Studio Ghibli (copas suaves multicapa, colores vivos de bosque Miyazaki y flores de pradera)
  function buildTreesAndRocks(scene, toonMat) {
    var cell = 12.5;
    var half = 78;
    var transforms = { oak: [], pine: [], sakura: [] };
    var rockTransforms = [];
    var flowerTransforms = { yellow: [], white: [], pink: [] };

    for (var gx = -half; gx < half; gx += cell) {
      for (var gz = -half; gz < half; gz += cell) {
        var x = gx + cell * 0.5 + (Math.random() - 0.5) * cell * 0.82;
        var z = gz + cell * 0.5 + (Math.random() - 0.5) * cell * 0.82;
        var rad = Math.hypot(x, z);
        if (rad < 15 || rad > 77) continue;
        if (STATIONS.some(function(s) { return Math.hypot(s.pos.x - x, s.pos.z - z) < 12.5; })) continue;
        if (FINISH_LINE && Math.hypot(FINISH_LINE.pos.x - x, FINISH_LINE.pos.z - z) < 10) continue;
        if (nearRoute(x, z, 6.8)) continue;
        var h = heightAt(x, z);
        var roll = Math.random();
        if (h >= 0.4 && h <= 11.5) {
          if (roll < 0.62) {
            var typeRoll = Math.random();
            var type = typeRoll < 0.46 ? 'oak' : (typeRoll < 0.80 ? 'pine' : 'sakura');
            var s = 0.9 + Math.random() * 0.55;
            var ry = Math.random() * Math.PI * 2;
            transforms[type].push({ x: x, y: h, z: z, s: s, ry: ry });
            var approxH = (type === 'pine' ? 7.2 : (type === 'oak' ? 5.6 : 5.2)) * s;
            TREE_SPAWN_POINTS.push({ x: x, y: h + approxH * 0.85, z: z });
            OBSTACLES.push({ x: x, z: z, r: 0.45 * s });
          } else if (roll < 0.72) {
            var rs = 0.65 + Math.random() * 0.85;
            rockTransforms.push({ x: x, y: h, z: z, s: rs, ry: Math.random() * Math.PI * 2 });
            OBSTACLES.push({ x: x, z: z, r: 0.45 * rs });
          }
        }
      }
    }

    // Flores silvestres estilo pradera Ghibli alrededor del campo
    for (var fi = 0; fi < 260; fi++) {
      var fx = (Math.random() - 0.5) * 145;
      var fz = (Math.random() - 0.5) * 145;
      var fr = Math.hypot(fx, fz);
      if (fr < 12 || fr > 74 || nearRoute(fx, fz, 4.2)) continue;
      var fh = heightAt(fx, fz);
      if (fh > 4.5) continue;
      var fType = fi % 3 === 0 ? 'yellow' : (fi % 3 === 1 ? 'white' : 'pink');
      flowerTransforms[fType].push({ x: fx, y: fh, z: fz, s: 0.7 + Math.random() * 0.6, ry: Math.random() * Math.PI });
    }

    var warmBarkMat = toonMat(0x6f4e37);
    var birchBarkMat = toonMat(0xe6dfd3);

    // 1. Árbol Frondoso Ghibli (Estilo Totoro: tronco con raíces y 5 esferas suaves superpuestas en 3 tonos de verde)
    var oakTrunk = new THREE.CylinderGeometry(0.18, 0.34, 2.5, 10); oakTrunk.translate(0, 1.25, 0);
    var oakCanopyDeep = new THREE.SphereGeometry(1.65, 14, 12); oakCanopyDeep.scale(1.15, 0.88, 1.15); oakCanopyDeep.translate(0, 3.0, 0);
    var oakCanopyMidA = new THREE.SphereGeometry(1.35, 14, 12); oakCanopyMidA.translate(-0.75, 3.45, 0.35);
    var oakCanopyMidB = new THREE.SphereGeometry(1.3, 14, 12); oakCanopyMidB.translate(0.75, 3.55, -0.3);
    var oakCanopyTop = new THREE.SphereGeometry(1.25, 14, 12); oakCanopyTop.scale(1.1, 0.9, 1.1); oakCanopyTop.translate(0, 4.35, 0.1);

    makeInstancedPart(scene, oakTrunk, warmBarkMat, transforms.oak);
    makeInstancedPart(scene, oakCanopyDeep, toonMat(0x2d7a4c), transforms.oak);
    makeInstancedPart(scene, oakCanopyMidA, toonMat(0x48a860), transforms.oak);
    makeInstancedPart(scene, oakCanopyMidB, toonMat(0x48a860), transforms.oak);
    makeInstancedPart(scene, oakCanopyTop, toonMat(0x7fd16b), transforms.oak);

    // 2. Pino / Ciprés Ghibli de montaña (capas redondeadas suaves en verde esmeralda y puntas iluminadas)
    var pineTrunk = new THREE.CylinderGeometry(0.12, 0.24, 3.0, 10); pineTrunk.translate(0, 1.5, 0);
    var pineT1 = new THREE.ConeGeometry(1.65, 2.3, 14); pineT1.translate(0, 3.2, 0);
    var pineT2 = new THREE.ConeGeometry(1.32, 2.0, 14); pineT2.translate(0, 4.45, 0);
    var pineT3 = new THREE.ConeGeometry(0.95, 1.7, 14); pineT3.translate(0, 5.55, 0);
    var pineT4 = new THREE.ConeGeometry(0.58, 1.25, 14); pineT4.translate(0, 6.45, 0);

    makeInstancedPart(scene, pineTrunk, warmBarkMat, transforms.pine);
    makeInstancedPart(scene, pineT1, toonMat(0x245e47), transforms.pine);
    makeInstancedPart(scene, pineT2, toonMat(0x2f7658), transforms.pine);
    makeInstancedPart(scene, pineT3, toonMat(0x40916c), transforms.pine);
    makeInstancedPart(scene, pineT4, toonMat(0x68b888), transforms.pine);

    // 3. Árbol Dorado / Primavera Ghibli (tronco claro y follaje cálido dorado/verde lima)
    var sakTrunk = new THREE.CylinderGeometry(0.1, 0.19, 3.1, 10); sakTrunk.translate(0, 1.55, 0);
    var sakPuff1 = new THREE.SphereGeometry(1.35, 14, 12); sakPuff1.translate(0, 3.6, 0);
    var sakPuff2 = new THREE.SphereGeometry(1.05, 12, 10); sakPuff2.translate(0.55, 4.2, 0.25);
    var sakPuff3 = new THREE.SphereGeometry(0.95, 12, 10); sakPuff3.translate(-0.5, 4.1, -0.3);

    makeInstancedPart(scene, sakTrunk, birchBarkMat, transforms.sakura);
    makeInstancedPart(scene, sakPuff1, toonMat(0x8cd867), transforms.sakura);
    makeInstancedPart(scene, sakPuff2, toonMat(0xb5e48c), transforms.sakura);
    makeInstancedPart(scene, sakPuff3, toonMat(0xd9ed92), transforms.sakura);

    // Rocas 3D esculpidas estilo Ghibli (reemplazan los cartones 2D pixelados)
    var rockGeo = new THREE.DodecahedronGeometry(0.85, 1);
    rockGeo.scale(1.25, 0.78, 1.05);
    rockGeo.translate(0, 0.35, 0);
    makeInstancedPart(scene, rockGeo, toonMat(0x7c8594), rockTransforms);

    // Flores de pradera 3D
    var flowerGeo = new THREE.SphereGeometry(0.16, 6, 6);
    flowerGeo.scale(1, 0.55, 1);
    flowerGeo.translate(0, 0.12, 0);
    makeInstancedPart(scene, flowerGeo, toonMat(0xffd166), flowerTransforms.yellow, false);
    makeInstancedPart(scene, flowerGeo, toonMat(0xfffcf2), flowerTransforms.white, false);
    makeInstancedPart(scene, flowerGeo, toonMat(0xff9ebb), flowerTransforms.pink, false);
  }

  function updateBillboards() {}

  return {
    heightAt: heightAt,
    slopeAt: slopeAt,
    platformHeightAt: platformHeightAt,
    isOnRoute: isOnRoute,
    buildTerrain: buildTerrain,
    buildCircuitRoad: buildCircuitRoad,
    buildStations: buildStations,
    buildTrickPark: buildTrickPark,
    buildTreesAndRocks: buildTreesAndRocks,
    updateBillboards: updateBillboards,
    getObstacles: function() { return OBSTACLES; },
    getRamps: function() { return RAMPS; },
    getStations: function() { return STATIONS; },
    getRoutes: function() { return ROUTES; },
    getTreeSpawnPoints: function() { return TREE_SPAWN_POINTS; },
    getTrickSignPos: function() { return TRICK_SIGN_POS; },
    getFinishLine: function() { return FINISH_LINE; }
  };
})();
