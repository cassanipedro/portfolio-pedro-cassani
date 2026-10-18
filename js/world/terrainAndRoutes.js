// World Builder: Terrain, Pronounced Lomas, Seamless Circuit Road, Stations & Foliage
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

  // 10 pronounced steep lomas around the circuit (avoiding station centers at i/5 * 2PI)
  var ROUTE_LOMAS = [];
  (function initLomas() {
    var span = (1 / 5) * Math.PI * 2;
    for (var i = 0; i < 5; i++) {
      var base = i * span;
      // First loma in each sector (~11m after each station/spawn)
      ROUTE_LOMAS.push({
        angle: base + span * 0.24,
        height: 6.2,
        halfW: 0.135
      });
      // Second bigger loma in each sector
      ROUTE_LOMAS.push({
        angle: base + span * 0.64,
        height: 7.2,
        halfW: 0.145
      });
    }
  })();

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
        h += lm.height * Math.pow(u, 1.25);
      }
    }
    return h;
  }

  function rawHeightAt(x, z) {
    var r = Math.sqrt(x * x + z * z);
    var mountain = Math.pow(Math.max(0, (r - 52)) * 0.055, 1.6);
    var n1 = Math.sin(x * 0.05 + 1.3) * Math.cos(z * 0.045) * 2.1;
    var n2 = Math.sin(x * 0.11 - z * 0.09) * 1.0;
    var n3 = Math.sin((x + z) * 0.025) * 3.2;
    return mountain * 5 + n3 * (0.3 + mountain * 0.12) + n1 + n2;
  }

  function roadCenterHeightAtAngle(ang) {
    var cx = Math.sin(ang) * CIRCUIT_RADIUS;
    var cz = Math.cos(ang) * CIRCUIT_RADIUS;
    return rawHeightAt(cx, cz) + lomaHeightAtAngle(ang);
  }

  function heightAt(x, z) {
    var r = Math.sqrt(x * x + z * z);
    var hNat = rawHeightAt(x, z);
    var distRoad = Math.abs(r - CIRCUIT_RADIUS);
    if (distRoad >= 11.0 || r < 5) return hNat;
    var ang = Math.atan2(x, z);
    var hRoad = roadCenterHeightAtAngle(ang);
    if (distRoad <= 3.5) return hRoad;
    var t = (distRoad - 3.5) / (11.0 - 3.5);
    var s = t * t * (3 - 2 * t);
    return hRoad * (1 - s) + hNat * s;
  }

  // Recess terrain mesh directly under the asphalt roadbed so terrain triangles can NEVER poke through
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

  function colorForHeight(h) {
    var snow = new THREE.Color(0xf4ede0);
    var rock = new THREE.Color(0x7d6a5c);
    var dirt = new THREE.Color(0x8a6a44);
    var grass = new THREE.Color(0x5f9450);
    if (h < 1.2) return grass;
    if (h < 5) return grass.clone().lerp(dirt, (h - 1.2) / 3.8);
    if (h < 13) return dirt.clone().lerp(rock, (h - 5) / 8);
    return rock.clone().lerp(snow, Math.min(1, (h - 13) / 8));
  }

  function hashRand(x, z) {
    var s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  function buildTerrain(scene, toonGrad) {
    var seg = 170;
    var size = WORLD_R * 2 + 10;
    var half = size / 2;
    var step = size / seg;
    var positions = [], colors = [];
    for (var i = 0; i < seg; i++) {
      for (var j = 0; j < seg; j++) {
        var x0 = -half + i * step, x1 = x0 + step;
        var z0 = -half + j * step, z1 = z0 + step;
        var hA = terrainMeshHeightAt(x0, z0),
            hB = terrainMeshHeightAt(x1, z0),
            hC = terrainMeshHeightAt(x1, z1),
            hD = terrainMeshHeightAt(x0, z1);
        var tris = [
          [x0, hA, z0, x0, hD, z1, x1, hC, z1],
          [x0, hA, z0, x1, hC, z1, x1, hB, z0]
        ];
        for (var t = 0; t < 2; t++) {
          var tri = tris[t];
          var avg = (tri[1] + tri[4] + tri[7]) / 3;
          var variance = 0.9 + hashRand(x0 + t * 3.3, z0) * 0.2;
          var c = colorForHeight(avg).multiplyScalar(variance);
          for (var k = 0; k < 3; k++) {
            positions.push(tri[k * 3], tri[k * 3 + 1], tri[k * 3 + 2]);
            colors.push(c.r, c.g, c.b);
          }
        }
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    var mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGrad });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  function makeRouteTexture(colorHex) {
    var w = 16, h = 32;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var n = window.pixHash(x, y);
        ctx.fillStyle = n > 0.5 ? '#4e4e52' : '#434348';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.fillStyle = '#726f68';
    ctx.fillRect(0, 0, 1, h);
    ctx.fillRect(w - 1, 0, 1, h);
    ctx.fillStyle = window.hexStr(colorHex);
    for (var y2 = 1; y2 < h; y2 += 8) {
      ctx.fillRect(w / 2 - 1, y2, 2, 4);
    }
    var tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // Analytical, 100% seamless closed ring road builder (zero start/end seam, zero terrain clipping)
  function buildCircuitRoad(scene, toonGrad, colorHex) {
    var SEGMENTS = 420;
    var hw = 2.8;
    var positions = [], uvs = [], idx = [], pts = [];
    var circumference = 2 * Math.PI * CIRCUIT_RADIUS;
    var totalV = Math.round(circumference * 0.25);

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
    ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
    ctx.fillStyle = hexColor;
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();
    ctx.fillStyle = '#1b1410';
    ctx.font = 'bold 120px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2 + 10);
    var tex = new THREE.CanvasTexture(cnv);
    var mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    var spr = new THREE.Sprite(mat);
    spr.scale.set(3.2, 3.2, 1);
    return spr;
  }

  function makeFacadeTexture(accentHex) {
    var w = 48, h = 128;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#54606e';
    ctx.fillRect(0, 0, w, h);
    for (var row = 3; row < h - 4; row += 8) {
      for (var col = 3; col < w - 4; col += 8) {
        var lit = Math.random() < 0.4;
        ctx.fillStyle = lit ? '#ffe3a0' : '#262c35';
        ctx.fillRect(col, row, 5, 6);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (var col2 = 0; col2 < w; col2 += 8) { ctx.fillRect(col2, 0, 1, h); }
    ctx.fillStyle = accentHex;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(w - 7, 0, 4, h);
    ctx.globalAlpha = 1;
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  function makeSignTexture(text, accentHex) {
    var w = 256, h = 64;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#14100d';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = accentHex;
    ctx.fillRect(0, h - 6, w, 6);
    ctx.fillStyle = '#f4ead9';
    ctx.font = 'bold 34px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), w / 2, h / 2 - 4);
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
    var postMat = toonMat(0x3a2e22);
    var post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.8, 6), postMat);
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
    c.width = c.height = 16;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#d4342a';
    ctx.fillRect(6, 1, 4, 14);
    ctx.fillRect(1, 6, 14, 4);
    var tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
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
        var trimMat = toonMat(0x33353b);
        var baseMat = toonMat(0x6b625a);

        var podium = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.6, 6.4), baseMat);
        podium.position.y = 1.3; podium.castShadow = true; podium.receiveShadow = true;
        group.add(podium);
        var canopy = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 2), trimMat);
        canopy.position.set(0, 2.8, 2.6); canopy.castShadow = true;
        group.add(canopy);
        var door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2, 0.1), new THREE.MeshToonMaterial({ color: 0x202327, gradientMap: toonGrad, emissive: 0x3a4654, emissiveIntensity: 0.4 }));
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
        var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 6), trimMat);
        mast.position.y = 2.6 + shaftH + upperH + 1.5;
        group.add(mast);
        var acUnit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), trimMat);
        acUnit.position.set(1, 2.6 + shaftH + upperH + 0.5, 0.6);
        group.add(acUnit);

        var sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: makeSignTexture(st.title, SIGN_COLOR) }));
        sign.position.set(0, 2.6 + shaftH * 0.78, 2.32);
        group.add(sign);

        var beamMat = new THREE.MeshBasicMaterial({ color: st.color, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false });
        var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.02, 7, 8, 1, true), beamMat);
        beam.position.y = 2.6 + shaftH + upperH + 3.5;
        group.add(beam);
        var label = makeLabelSprite('1', accentHex);
        label.position.y = 2.6 + shaftH + upperH + 4.6;
        group.add(label);

        scene.add(group);
        st.marker = group;
        st.flag = label;
      } else {
        // Flag marker
        var fGroup = new THREE.Group();
        fGroup.position.copy(st.pos);
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 6), toonMat(0x3a2e22));
        pole.position.y = 2.5; pole.castShadow = true;
        fGroup.add(pole);
        var flag = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.5, 10, 1, true), toonMat(st.color, { emissive: st.color, emissiveIntensity: 0.3 }));
        flag.position.y = 5.5; flag.rotation.x = Math.PI;
        fGroup.add(flag);
        var beamMat2 = new THREE.MeshBasicMaterial({ color: st.color, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
        var beam2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.02, 9, 8, 1, true), beamMat2);
        beam2.position.y = 5.4;
        fGroup.add(beam2);
        var label2 = makeLabelSprite(String(st.id + 1), window.hexStr(st.color));
        label2.position.y = 7.2;
        fGroup.add(label2);
        scene.add(fGroup);
        st.marker = fGroup;
        st.flag = flag;

        // Theme prop
        var pGroup = new THREE.Group();
        pGroup.position.copy(st.pos);
        var darkMat = toonMat(0x33363c);
        var greyMat = toonMat(0x8d8f93);
        var rustMat = toonMat(0xb5622f);
        var crateMat = toonMat(0xb08a4e);

        if (st.id === 1) {
          OBSTACLES.push({ x: st.pos.x + 4.2, z: st.pos.z, r: 5.0 });
          var wallMat = toonMat(0xc9c3b3);
          var body = new THREE.Mesh(new THREE.BoxGeometry(8.5, 5.2, 6.5), wallMat);
          body.position.set(4.2, 2.6, 0); body.castShadow = true; body.receiveShadow = true;
          pGroup.add(body);
          var roofCap = new THREE.Mesh(new THREE.BoxGeometry(8.9, 0.3, 6.9), darkMat);
          roofCap.position.set(4.2, 5.3, 0); pGroup.add(roofCap);
          [-2.2, 2.2].forEach(function(vx) {
            var vent = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.8), darkMat);
            vent.position.set(4.2 + vx, 5.7, 0); pGroup.add(vent);
          });
          var canopy2 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.25, 2.4), darkMat);
          canopy2.position.set(0.3, 4.0, 0); canopy2.castShadow = true; pGroup.add(canopy2);
          var door2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.4, 3.2), new THREE.MeshToonMaterial({ color: 0x202327, gradientMap: toonGrad, emissive: 0x3a4654, emissiveIntensity: 0.35 }));
          door2.position.set(-0.05, 1.9, 0); pGroup.add(door2);
          var ramp = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 3.2), greyMat);
          ramp.position.set(-1.3, 0.25, 0); ramp.rotation.z = 0.14; ramp.castShadow = true; pGroup.add(ramp);
          var crateSpots = [[-2.6, -2.6], [-1.7, -2.6], [-2.6, -1.7], [-3.4, -2.1], [-2.1, -3.3], [-3.0, -1.1]];
          crateSpots.forEach(function(p, idxC) {
            var crate = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), crateMat);
            crate.position.set(p[0], 0.5, p[1]); crate.rotation.y = Math.random() * 0.6; crate.castShadow = true;
            pGroup.add(crate);
            if (idxC % 2 === 0) {
              var crate2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), crateMat);
              crate2.position.set(p[0] + 0.05, 1.45, p[1] - 0.05); crate2.rotation.y = Math.random() * 0.6; crate2.castShadow = true;
              pGroup.add(crate2);
            }
          });
          buildStationSign(scene, toonMat, st.pos, 'Almacén de Logística', SIGN_COLOR, 7.5);
        } else if (st.id === 2) {
          OBSTACLES.push({ x: st.pos.x - 1.6, z: st.pos.z - 1.4, r: 1.3 });
          var rack = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.6, 1.1), darkMat);
          rack.position.set(-1.6, 1.3, -1.4); rack.castShadow = true;
          pGroup.add(rack);
          for (var li = 0; li < 5; li++) {
            var light = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.07), toonMat(li % 2 ? 0x3fae5c : 0xff8a3d, { emissive: li % 2 ? 0x3fae5c : 0xff8a3d, emissiveIntensity: 0.6 }));
            light.position.set(-1.6, 0.5 + li * 0.45, -0.95); pGroup.add(light);
          }
          var rack2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.8), darkMat);
          rack2.position.set(2.0, 0.8, 1.3); rack2.castShadow = true; pGroup.add(rack2);
        } else if (st.id === 3) {
          OBSTACLES.push({ x: st.pos.x - 3.0, z: st.pos.z + 0.8, r: 3.2 });
          var tank = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 5.6, 16), greyMat);
          tank.position.set(-3, 2.8, 0.8); tank.castShadow = true; tank.receiveShadow = true;
          pGroup.add(tank);
          var cap = new THREE.Mesh(new THREE.ConeGeometry(2.35, 1.0, 16), rustMat);
          cap.position.set(-3, 5.8, 0.8); pGroup.add(cap);
          var band = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.35, 0.3, 16), rustMat);
          band.position.set(-3, 1.6, 0.8); pGroup.add(band);
          var tank2 = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 3.4, 14), greyMat);
          tank2.position.set(1.0, 1.7, 2.2); tank2.castShadow = true; pGroup.add(tank2);
          var pipe1 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 4.6, 8), rustMat);
          pipe1.rotation.z = Math.PI / 2; pipe1.position.set(-0.8, 0.7, 0.8); pipe1.castShadow = true;
          pGroup.add(pipe1);
          var pipe2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.3, 8), rustMat);
          pipe2.position.set(1.0, 0.9, 0.4); pipe2.castShadow = true;
          pGroup.add(pipe2);
          var flareStack = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.5, 8), darkMat);
          flareStack.position.set(2.8, 3.25, -1.6); flareStack.castShadow = true; pGroup.add(flareStack);
          var flame = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.9, 8), new THREE.MeshBasicMaterial({ color: 0xff8a3d }));
          flame.position.set(2.8, 6.9, -1.6); pGroup.add(flame);
          var shed = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), toonMat(0x6b625a));
          shed.position.set(2.3, 0.7, 2.4); shed.castShadow = true; pGroup.add(shed);
          buildStationSign(scene, toonMat, st.pos, 'Planta Petrolera', SIGN_COLOR, 7.5);
        } else if (st.id === 4) {
          OBSTACLES.push({ x: st.pos.x, z: st.pos.z - 1.6, r: 2.6 });
          var baseTent = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.9, 4.2), toonMat(0xe9e4d6));
          baseTent.position.set(0, 0.95, -1.6); baseTent.castShadow = true; baseTent.receiveShadow = true;
          pGroup.add(baseTent);
          var roofMat = toonMat(0xd94f3b);
          var roof1 = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.16, 3.0), roofMat);
          roof1.position.set(0, 2.3, -2.3); roof1.rotation.x = 0.55; roof1.castShadow = true;
          pGroup.add(roof1);
          var roof2 = roof1.clone(); roof2.position.z = -0.9; roof2.rotation.x = -0.55;
          pGroup.add(roof2);
          var crossTex = makeCrossTexture();
          var cross = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshBasicMaterial({ map: crossTex }));
          cross.position.set(0, 1.7, -1.58); pGroup.add(cross);
          var tent2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 2.2), toonMat(0xe9e4d6));
          tent2.position.set(3.6, 0.65, 0.6); tent2.castShadow = true; pGroup.add(tent2);
          var roof3 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 1.6), roofMat);
          roof3.position.set(3.6, 1.5, 1.3); roof3.rotation.x = 0.5; roof3.castShadow = true;
          pGroup.add(roof3);
          var roof4 = roof3.clone(); roof4.position.z = -0.1; roof4.rotation.x = -0.5;
          pGroup.add(roof4);
          var pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.8, 6), toonMat(0x6b625a));
          pole2.position.set(-3.0, 1.9, 1.5); pole2.castShadow = true; pGroup.add(pole2);
          var flag2 = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), new THREE.MeshBasicMaterial({ map: crossTex, side: THREE.DoubleSide }));
          flag2.position.set(-2.5, 3.3, 1.5); pGroup.add(flag2);
          buildStationSign(scene, toonMat, st.pos, 'Campo de Médicos', SIGN_COLOR, 7.5);
        }
        scene.add(pGroup);
      }
    });
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
      var rampMat = toonMat(0x8a6a44);
      var deck = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.4, 7), rampMat);
      deck.rotation.x = -0.42;
      deck.position.set(0, 1.3, 0.5);
      deck.castShadow = true; deck.receiveShadow = true;
      group.add(deck);
      var strutMat = toonMat(0x4a3826);
      var strut1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.6, 0.3), strutMat);
      strut1.position.set(2.2, 1.1, 2.6);
      group.add(strut1);
      var strut2 = strut1.clone(); strut2.position.x = -2.2;
      group.add(strut2);
      var sign = makeLabelSprite('!', '#7dd3fc');
      sign.scale.set(1.5, 1.5, 1);
      sign.position.set(0, 3.1, 1.8);
      group.add(sign);
      scene.add(group);
      RAMPS.push({ pos: new THREE.Vector3(x, h, z), heading: heading, power: power || 1 });
    }

    function buildGrindRail(cx, cz, heading, totalLength, rampLen, deckHeight) {
      var group = new THREE.Group();
      var h = heightAt(cx, cz);
      group.position.set(cx, h, cz);
      group.rotation.y = heading;
      var deckW = 1.15;
      var flatLen = totalLength - rampLen * 2;
      var halfLen = totalLength / 2;
      var slopeAngle = Math.atan2(deckHeight, rampLen);
      var deckMat = toonMat(0x8d939c);
      var rampMat = toonMat(0x6b6f76);
      var legMat = toonMat(0x3a3f46);

      var deck = new THREE.Mesh(new THREE.BoxGeometry(deckW, 0.18, flatLen), deckMat);
      deck.position.set(0, deckHeight, 0);
      deck.castShadow = true; deck.receiveShadow = true;
      group.add(deck);

      var rampIn = new THREE.Mesh(new THREE.BoxGeometry(deckW, 0.18, rampLen / Math.cos(slopeAngle)), rampMat);
      rampIn.position.set(0, deckHeight / 2, -(flatLen / 2 + rampLen / 2));
      rampIn.rotation.x = -slopeAngle;
      rampIn.castShadow = true; rampIn.receiveShadow = true;
      group.add(rampIn);

      var rampOut = new THREE.Mesh(new THREE.BoxGeometry(deckW, 0.18, rampLen / Math.cos(slopeAngle)), rampMat);
      rampOut.position.set(0, deckHeight / 2, (flatLen / 2 + rampLen / 2));
      rampOut.rotation.x = slopeAngle;
      rampOut.castShadow = true; rampOut.receiveShadow = true;
      group.add(rampOut);

      for (var i = -1; i <= 1; i += 2) {
        var leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, deckHeight, 0.14), legMat);
        leg.position.set(0, deckHeight / 2, i * flatLen * 0.32);
        leg.castShadow = true;
        group.add(leg);
        var railBar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, totalLength * 0.96, 8), legMat);
        railBar.rotation.x = Math.PI / 2;
        railBar.position.set(i * deckW * 0.56, deckHeight + 0.22, 0);
        group.add(railBar);
      }

      var sign = makeLabelSprite('!', '#7dd3fc');
      sign.scale.set(1.3, 1.3, 1);
      sign.position.set(0, deckHeight + 1.4, -(halfLen - 0.3));
      group.add(sign);

      scene.add(group);
      addRailPlatform(cx, cz, heading, totalLength, rampLen, 1.6, deckHeight);
    }

    function buildLandingBox(x, z, size, height) {
      var group = new THREE.Group();
      var h = heightAt(x, z);
      group.position.set(x, h, z);
      var boxMat = toonMat(0x8a6a44);
      var top = new THREE.Mesh(new THREE.BoxGeometry(size, height, size), boxMat);
      top.position.set(0, height / 2, 0);
      top.castShadow = true; top.receiveShadow = true;
      group.add(top);
      var trimMat = toonMat(0x4a3826);
      var trim = new THREE.Mesh(new THREE.BoxGeometry(size + 0.15, 0.14, size + 0.15), trimMat);
      trim.position.set(0, height + 0.07, 0);
      group.add(trim);
      scene.add(group);
      addRailPlatform(x, z, 0, size, 0.4, size, height);
    }

    function buildStairsDown(x, z, heading, fromHeight, steps) {
      var group = new THREE.Group();
      var h = heightAt(x, z);
      group.position.set(x, h, z);
      group.rotation.y = heading;
      var stepMat = toonMat(0x6e5436);
      var stepH = fromHeight / steps;
      var stepDepth = 0.9;
      for (var i = 0; i < steps; i++) {
        var stepY = fromHeight - stepH * (i + 0.5);
        var stepZ = i * stepDepth + stepDepth * 0.5;
        var step = new THREE.Mesh(new THREE.BoxGeometry(2.4, stepH, stepDepth), stepMat);
        step.position.set(0, stepY, stepZ);
        step.castShadow = true; step.receiveShadow = true;
        group.add(step);
      }
      scene.add(group);
    }

    var angle = (0.5 / 5) * Math.PI * 2;
    var radius = 64;
    var tp = { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius };
    var rampX = tp.x - 8, rampZ = tp.z - 2;
    var rampHeading = Math.atan2(tp.x - rampX, tp.z - rampZ);
    buildRamp(rampX, rampZ, rampHeading, 1.2);
    buildGrindRail(tp.x - 10, tp.z + 9, rampHeading, 6.5, 2.0, 1.0);
    var boxX = tp.x + 5, boxZ = tp.z + 1, boxH = 1.6;
    buildLandingBox(boxX, boxZ, 4.6, boxH);
    buildStairsDown(boxX, boxZ + 2.4, rampHeading, boxH, 5);
    var signCenter = { x: tp.x, z: tp.z - 10 };
    buildStationSign(scene, toonMat, signCenter, 'Zona de Trucos', SIGN_COLOR, 0);
    TRICK_SIGN_POS = { x: signCenter.x, z: signCenter.z };
  }

  function paintRockTexture() {
    var w = 22, h = 16;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    var pts = [[2, h - 1], [3, 7], [10, 2], [18, 5], [20, h - 2]];
    ctx.fillStyle = '#8d8072';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var idx = ctx.getImageData(x, y, 1, 1).data;
        if (idx[3] > 0) {
          var n = window.pixHash(x, y);
          ctx.fillStyle = x < 10 ? (n > 0.5 ? '#b4a996' : '#8d8072') : (n > 0.5 ? '#726656' : '#8d8072');
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  function makeInstancedPart(scene, geo, mat, transforms) {
    var mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, transforms.length));
    mesh.count = transforms.length;
    var dummy = new THREE.Object3D();
    for (var i = 0; i < transforms.length; i++) {
      var t = transforms[i];
      dummy.position.set(t.x, t.y, t.z);
      dummy.rotation.set(0, t.ry, 0);
      dummy.scale.setScalar(t.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.castShadow = true;
    scene.add(mesh);
    return mesh;
  }

  function buildTreesAndRocks(scene, toonMat) {
    var cell = 13;
    var half = 78;
    var weights = { pine: 0.4, round: 0.38, birch: 0.22 };
    var transforms = { pine: [], round: [], birch: [] };
    var rockItems = [];

    for (var gx = -half; gx < half; gx += cell) {
      for (var gz = -half; gz < half; gz += cell) {
        var x = gx + cell * 0.5 + (Math.random() - 0.5) * cell * 0.82;
        var z = gz + cell * 0.5 + (Math.random() - 0.5) * cell * 0.82;
        var rad = Math.hypot(x, z);
        if (rad < 16 || rad > 76) continue;
        if (STATIONS.some(function(s) { return Math.hypot(s.pos.x - x, s.pos.z - z) < 13; })) continue;
        if (nearRoute(x, z, 6.5)) continue;
        var h = heightAt(x, z);
        var roll = Math.random();
        if (h >= 0.6 && h <= 11) {
          if (roll < 0.58) {
            var typeRoll = Math.random();
            var type = typeRoll < weights.pine ? 'pine' : (typeRoll < weights.pine + weights.round ? 'round' : 'birch');
            var s = 0.85 + Math.random() * 0.55;
            var ry = Math.random() * Math.PI * 2;
            transforms[type].push({ x: x, y: h, z: z, s: s, ry: ry });
            var approxH = (type === 'pine' ? 7.0 : (type === 'round' ? 4.4 : 5.9)) * s;
            TREE_SPAWN_POINTS.push({ x: x, y: h + approxH * 0.85, z: z });
            OBSTACLES.push({ x: x, z: z, r: 0.42 * s });
          } else if (roll < 0.7) {
            var rs = 0.6 + Math.random() * 0.9;
            rockItems.push({ x: x, y: h, z: z, s: rs });
            OBSTACLES.push({ x: x, z: z, r: 0.4 * rs });
          }
        } else if (h > 11 && roll < 0.45) {
          var rs2 = 0.6 + Math.random() * 0.9;
          rockItems.push({ x: x, y: h, z: z, s: rs2 });
          OBSTACLES.push({ x: x, z: z, r: 0.4 * rs2 });
        }
      }
    }

    var barkMat = toonMat(0x5a3d26);
    var pineTrunkGeo = new THREE.CylinderGeometry(0.1, 0.16, 3.2, 6); pineTrunkGeo.translate(0, 1.6, 0);
    var pineT1 = new THREE.ConeGeometry(1.45, 2.0, 7); pineT1.translate(0, 3.4, 0);
    var pineT2 = new THREE.ConeGeometry(1.1, 1.7, 7); pineT2.translate(0, 4.6, 0);
    var pineT3 = new THREE.ConeGeometry(0.7, 1.3, 7); pineT3.translate(0, 5.65, 0);
    var pineMat = toonMat(0x33603a);
    makeInstancedPart(scene, pineTrunkGeo, barkMat, transforms.pine);
    makeInstancedPart(scene, pineT1, pineMat, transforms.pine);
    makeInstancedPart(scene, pineT2, pineMat, transforms.pine);
    makeInstancedPart(scene, pineT3, pineMat, transforms.pine);

    var roundTrunkGeo = new THREE.CylinderGeometry(0.13, 0.19, 2.0, 6); roundTrunkGeo.translate(0, 1.0, 0);
    var roundCanopyA = new THREE.IcosahedronGeometry(1.5, 0); roundCanopyA.translate(-0.3, 2.6, 0.1);
    var roundCanopyB = new THREE.IcosahedronGeometry(1.25, 0); roundCanopyB.translate(0.45, 2.9, -0.2);
    var roundMat = toonMat(0x4c8a4a);
    makeInstancedPart(scene, roundTrunkGeo, barkMat, transforms.round);
    makeInstancedPart(scene, roundCanopyA, roundMat, transforms.round);
    makeInstancedPart(scene, roundCanopyB, roundMat, transforms.round);

    var birchTrunkGeo = new THREE.CylinderGeometry(0.07, 0.1, 3.6, 6); birchTrunkGeo.translate(0, 1.8, 0);
    var birchCanopy = new THREE.IcosahedronGeometry(1.1, 0); birchCanopy.translate(0, 4.3, 0);
    var birchBarkMat = toonMat(0xd8d2c4);
    var birchMat = toonMat(0x8fc36b);
    makeInstancedPart(scene, birchTrunkGeo, birchBarkMat, transforms.birch);
    makeInstancedPart(scene, birchCanopy, birchMat, transforms.birch);

    var rockTex = paintRockTexture();
    var geo = new THREE.PlaneGeometry(1.3, 1.0);
    geo.translate(0, 0.5, 0);
    var mat = new THREE.MeshBasicMaterial({ map: rockTex, alphaTest: 0.4, side: THREE.DoubleSide });
    var rockMesh = new THREE.InstancedMesh(geo, mat, Math.max(1, rockItems.length));
    rockMesh.count = rockItems.length;
    scene.add(rockMesh);
    billboardGroups.push({ mesh: rockMesh, items: rockItems, sway: false });
  }

  var billboardDummy = new THREE.Object3D();
  function updateBillboards(camera, bike) {
    var yaw = Math.atan2(camera.position.x - bike.position.x, camera.position.z - bike.position.z);
    var q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
    billboardGroups.forEach(function(g) {
      for (var i = 0; i < g.items.length; i++) {
        var it = g.items[i];
        billboardDummy.position.set(it.x, it.y, it.z);
        billboardDummy.quaternion.copy(q);
        billboardDummy.scale.setScalar(it.s);
        billboardDummy.updateMatrix();
        g.mesh.setMatrixAt(i, billboardDummy.matrix);
      }
      g.mesh.instanceMatrix.needsUpdate = true;
    });
  }

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
    getTrickSignPos: function() { return TRICK_SIGN_POS; }
  };
})();
