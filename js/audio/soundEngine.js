// Procedural Web Audio Sound Engine: Motorcycle Engine (RPM + Gears), Cornering/Drift, Turbo Flames & Weather Ambience
window.SoundEngine = (function() {
  'use strict';

  var ctx = null;
  var initialized = false;
  var muted = false;

  // Master & bus gains
  var masterGain = null;

  // Motorcycle engine nodes
  var engOsc1 = null;
  var engOsc2 = null;
  var engSubOsc = null;
  var engFilter = null;
  var engGain = null;

  // Turbo flame jet/crackle nodes
  var turboFilter = null;
  var turboGain = null;
  var turboOsc = null;
  var turboOscGain = null;

  // Cornering / Tire maneuver scrub nodes
  var tireFilter = null;
  var tireGain = null;

  // Weather ambient nodes (low, soothing rain / snow whisper)
  var weatherFilter = null;
  var weatherGain = null;
  var weatherLfo = null;
  var weatherLfoGain = null;
  var currentWeatherMode = 'sun';

  function makeNoiseBuffer(audioCtx, seconds, pink) {
    var sampleRate = audioCtx.sampleRate;
    var length = sampleRate * seconds;
    var buffer = audioCtx.createBuffer(1, length, sampleRate);
    var data = buffer.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (var i = 0; i < length; i++) {
      var white = Math.random() * 2 - 1;
      if (pink) {
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
        b6 = white * 0.115926;
      } else {
        data[i] = white;
      }
    }
    return buffer;
  }

  function makeDistortionCurve(amount) {
    var k = typeof amount === 'number' ? amount : 25;
    var nSamples = 256;
    var curve = new Float32Array(nSamples);
    var deg = Math.PI / 180;
    for (var i = 0; i < nSamples; ++i) {
      var x = i * 2 / nSamples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  function init() {
    if (initialized) {
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return;
    }
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      ctx = new AudioCtx();
    } catch (e) {
      return;
    }

    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 0.75;
    masterGain.connect(ctx.destination);

    // 1. MOTOR DE LA MOTO (3 osciladores armónicos + waveshaper cálido + filtro pasa-bajos dinámico)
    engFilter = ctx.createBiquadFilter();
    engFilter.type = 'lowpass';
    engFilter.frequency.value = 180;
    engFilter.Q.value = 2.4;

    var shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortionCurve(18);
    shaper.oversample = '2x';

    engGain = ctx.createGain();
    engGain.gain.value = 0.0;

    engOsc1 = ctx.createOscillator();
    engOsc1.type = 'sawtooth';
    engOsc1.frequency.value = 46;

    engOsc2 = ctx.createOscillator();
    engOsc2.type = 'triangle';
    engOsc2.frequency.value = 92;

    engSubOsc = ctx.createOscillator();
    engSubOsc.type = 'sine';
    engSubOsc.frequency.value = 23;

    var osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.45;
    var subGain = ctx.createGain();
    subGain.gain.value = 0.55;

    engOsc1.connect(shaper);
    engOsc2.connect(osc2Gain);
    osc2Gain.connect(shaper);
    engSubOsc.connect(subGain);
    subGain.connect(engFilter);

    shaper.connect(engFilter);
    engFilter.connect(engGain);
    engGain.connect(masterGain);

    engOsc1.start();
    engOsc2.start();
    engSubOsc.start();

    var pinkNoiseBuf = makeNoiseBuffer(ctx, 4, true);

    // 2. SONIDO DE LLAMAS / TURBO (Rumor de fuego y postquemador)
    var turboNoise = ctx.createBufferSource();
    turboNoise.buffer = pinkNoiseBuf;
    turboNoise.loop = true;

    turboFilter = ctx.createBiquadFilter();
    turboFilter.type = 'bandpass';
    turboFilter.frequency.value = 340;
    turboFilter.Q.value = 1.2;

    turboGain = ctx.createGain();
    turboGain.gain.value = 0.0;

    turboOsc = ctx.createOscillator();
    turboOsc.type = 'sawtooth';
    turboOsc.frequency.value = 68;
    turboOscGain = ctx.createGain();
    turboOscGain.gain.value = 0.0;

    turboNoise.connect(turboFilter);
    turboFilter.connect(turboGain);
    turboGain.connect(masterGain);

    turboOsc.connect(turboOscGain);
    turboOscGain.connect(masterGain);

    turboNoise.start();
    turboOsc.start();

    // 3. SONIDO DE MANIOBRA / DERRAPE DE NEUMÁTICOS EN ASFALTO
    var tireNoise = ctx.createBufferSource();
    tireNoise.buffer = pinkNoiseBuf;
    tireNoise.loop = true;

    tireFilter = ctx.createBiquadFilter();
    tireFilter.type = 'bandpass';
    tireFilter.frequency.value = 820;
    tireFilter.Q.value = 3.2;

    tireGain = ctx.createGain();
    tireGain.gain.value = 0.0;

    tireNoise.connect(tireFilter);
    tireFilter.connect(tireGain);
    tireGain.connect(masterGain);
    tireNoise.start();

    // 4. SONIDO AMBIENTAL BAJITO DE LLUVIA O NIEVE
    var weatherNoise = ctx.createBufferSource();
    weatherNoise.buffer = pinkNoiseBuf;
    weatherNoise.loop = true;

    weatherFilter = ctx.createBiquadFilter();
    weatherFilter.type = 'lowpass';
    weatherFilter.frequency.value = 900;
    weatherFilter.Q.value = 0.9;

    weatherLfo = ctx.createOscillator();
    weatherLfo.type = 'sine';
    weatherLfo.frequency.value = 0.22;
    weatherLfoGain = ctx.createGain();
    weatherLfoGain.gain.value = 120;
    weatherLfo.connect(weatherLfoGain);
    weatherLfoGain.connect(weatherFilter.frequency);
    weatherLfo.start();

    weatherGain = ctx.createGain();
    weatherGain.gain.value = 0.008;

    weatherNoise.connect(weatherFilter);
    weatherFilter.connect(weatherGain);
    weatherGain.connect(masterGain);
    weatherNoise.start();

    initialized = true;
    setWeatherMode(currentWeatherMode);
  }

  function update(dt, state) {
    if (!initialized || !ctx) return;
    if (ctx.state === 'suspended') return;

    var now = ctx.currentTime;
    var spd = Math.abs(state.speed || 0);
    var throttle = state.throttle || 0;
    var steer = Math.abs(state.steer || 0);
    var turbo = !!state.turboActive;
    var airborne = !!state.airborne;
    var wheelie = state.wheelie || 0;

    // Simulación de 4 marchas para que el motor suene realista al acelerar
    var gearSpeeds = [0, 8.5, 16.5, 24.5, 42];
    var gear = 0;
    for (var g = 0; g < 4; g++) {
      if (spd >= gearSpeeds[g]) gear = g;
    }
    var gearMin = gearSpeeds[gear];
    var gearMax = gearSpeeds[gear + 1];
    var gearNormalized = Math.min(1, Math.max(0, (spd - gearMin) / (gearMax - gearMin)));

    // Frecuencia base del motor (RPM)
    var baseFreq = 36 + gear * 9 + gearNormalized * 46;
    if (throttle > 0) baseFreq += 8;
    if (turbo) baseFreq += 22;
    if (airborne && throttle > 0) baseFreq += 18;
    if (wheelie > 0.2) baseFreq += wheelie * 10;

    // Vibración orgánica de pistón monocilíndrico/bicilíndrico
    var flutter = Math.sin(performance.now() * 0.045) * 1.4;
    var f1 = Math.max(30, baseFreq + flutter);

    engOsc1.frequency.setTargetAtTime(f1, now, 0.04);
    engOsc2.frequency.setTargetAtTime(f1 * 2.01, now, 0.04);
    engSubOsc.frequency.setTargetAtTime(f1 * 0.5, now, 0.04);

    // Apertura de filtro y volumen según acelerador y velocidad
    var targetCutoff = 155 + (spd / 32) * 520 + (throttle > 0 ? 180 : 0) + (turbo ? 320 : 0);
    engFilter.frequency.setTargetAtTime(targetCutoff, now, 0.05);

    var targetEngGain = 0.038 + Math.min(0.085, (spd / 35) * 0.065) + (throttle > 0 ? 0.028 : 0) + (turbo ? 0.03 : 0);
    engGain.gain.setTargetAtTime(targetEngGain, now, 0.06);

    // Llamas de Turbo (postquemador de fuego)
    if (turbo) {
      var flameMod = 340 + Math.sin(performance.now() * 0.06) * 90;
      turboFilter.frequency.setTargetAtTime(flameMod, now, 0.03);
      turboGain.gain.setTargetAtTime(0.16, now, 0.04);
      turboOsc.frequency.setTargetAtTime(64 + Math.random() * 24, now, 0.02);
      turboOscGain.gain.setTargetAtTime(0.035, now, 0.04);
    } else {
      turboGain.gain.setTargetAtTime(0.0, now, 0.08);
      turboOscGain.gain.setTargetAtTime(0.0, now, 0.08);
    }

    // Maniobra y derrape de neumáticos o Grind metálico en el riel ("Super Truco")
    var grinding = !!state.grinding;
    if (grinding) {
      var grindFreq = 1480 + Math.sin(performance.now() * 0.08) * 220;
      tireFilter.frequency.setTargetAtTime(grindFreq, now, 0.02);
      tireFilter.Q.setTargetAtTime(5.5, now, 0.02);
      tireGain.gain.setTargetAtTime(0.14, now, 0.03);
    } else {
      var turnIntensity = (!airborne && spd > 4.5 && steer > 0.2)
        ? Math.min(1, ((steer - 0.2) / 0.8) * (spd / 20))
        : 0;
      var tireFreq = 650 + turnIntensity * 520 + Math.sin(performance.now() * 0.03) * 45;
      tireFilter.frequency.setTargetAtTime(tireFreq, now, 0.04);
      tireFilter.Q.setTargetAtTime(3.2, now, 0.04);
      tireGain.gain.setTargetAtTime(turnIntensity * 0.085, now, 0.05);
    }
  }

  // Sonido ambiental bajito según el clima ('sun', 'rain', 'snow')
  function setWeatherMode(mode) {
    currentWeatherMode = mode || 'sun';
    if (!initialized || !ctx) return;
    var now = ctx.currentTime;

    if (currentWeatherMode === 'rain') {
      // Lluvia suave y bajita de fondo
      weatherFilter.type = 'bandpass';
      weatherFilter.frequency.setTargetAtTime(1150, now, 0.8);
      weatherFilter.Q.setTargetAtTime(0.65, now, 0.8);
      weatherLfo.frequency.setTargetAtTime(0.35, now, 0.8);
      weatherLfoGain.gain.setTargetAtTime(160, now, 0.8);
      weatherGain.gain.setTargetAtTime(0.055, now, 1.2);
    } else if (currentWeatherMode === 'snow') {
      // Brisa invernal de nieve muy suave y bajita
      weatherFilter.type = 'bandpass';
      weatherFilter.frequency.setTargetAtTime(460, now, 0.8);
      weatherFilter.Q.setTargetAtTime(2.2, now, 0.8);
      weatherLfo.frequency.setTargetAtTime(0.18, now, 0.8);
      weatherLfoGain.gain.setTargetAtTime(190, now, 0.8);
      weatherGain.gain.setTargetAtTime(0.038, now, 1.2);
    } else {
      // Soleado: brisa de pradera apenas perceptible
      weatherFilter.type = 'lowpass';
      weatherFilter.frequency.setTargetAtTime(320, now, 0.8);
      weatherFilter.Q.setTargetAtTime(0.7, now, 0.8);
      weatherLfoGain.gain.setTargetAtTime(40, now, 0.8);
      weatherGain.gain.setTargetAtTime(0.008, now, 1.2);
    }
  }

  function playJump() {
    if (!initialized || !ctx || muted) return;
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.22);
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  function playLand() {
    if (!initialized || !ctx || muted) return;
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.16);
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  function playFanfare() {
    if (!initialized || !ctx || muted) return;
    var notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach(function(freq, idx) {
      var now = ctx.currentTime + idx * 0.09;
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(0.07, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.36);
    });
  }

  function toggleMute() {
    muted = !muted;
    if (!initialized) init();
    if (masterGain && ctx) {
      masterGain.gain.setTargetAtTime(muted ? 0 : 0.75, ctx.currentTime, 0.05);
    }
    return muted;
  }

  return {
    init: init,
    update: update,
    setWeatherMode: setWeatherMode,
    playJump: playJump,
    playLand: playLand,
    playFanfare: playFanfare,
    toggleMute: toggleMute,
    isMuted: function() { return muted; }
  };
})();
