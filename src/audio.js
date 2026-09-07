// 声音：Web Audio 全合成，无音频文件。
// 钟声用非谐泛音列合成（真实教堂钟的 hum / prime / tierce / quint / nominal），
// 室外是风与鸟，走进堂内自动安静下来、浮起极轻的圣咏式和声垫。
// 浏览器要求用户手势后才能出声：首次点击 / 按键时调用 ensure()。

export function createAudio() {
  let ctx = null;
  let master = null, windGain = null, padGain = null;
  let birdTimer = 0;
  let muted = false;
  let insideNow = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);

    // 风：环状白噪声 + 低通，缓慢起伏
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const wind = ctx.createBufferSource();
    wind.buffer = buf;
    wind.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 110;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();
    windGain = ctx.createGain();
    windGain.gain.value = 0.05;
    wind.connect(lp).connect(windGain).connect(master);
    wind.start();

    // 堂内和声垫：极轻的失谐正弦小和弦（D-A-D），只在室内浮现
    padGain = ctx.createGain();
    padGain.gain.value = 0;
    padGain.connect(master);
    for (const [f, g] of [[146.83, 0.5], [220, 0.35], [293.66, 0.25], [147.6, 0.3]]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g * 0.02;
      o.connect(og).connect(padGain);
      o.start();
    }

    scheduleBird();
  }

  function scheduleBird() {
    clearTimeout(birdTimer);
    birdTimer = setTimeout(() => {
      if (ctx && !insideNow && !muted) chirp();
      scheduleBird();
    }, 2500 + Math.random() * 6000);
  }

  function chirp() {
    const t0 = ctx.currentTime;
    const notes = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const f0 = 2600 + Math.random() * 1600;
      const t = t0 + i * (0.09 + Math.random() * 0.06);
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * (0.7 + Math.random() * 0.5), t + 0.07);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.02, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.12);
    }
  }

  // 一记钟。base 为基频（prime），泛音比与衰减取自真实钟的声学测量近似。
  function bell(base = 196, vel = 1, when = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const partials = [
      [0.5, 0.55, 7.0],    // hum
      [1.0, 1.0, 4.5],     // prime
      [1.188, 0.6, 3.2],   // tierce（小三度——钟声哀婉的来源）
      [1.506, 0.35, 2.6],  // quint
      [2.0, 0.4, 1.9],     // nominal
      [2.662, 0.2, 1.1],
      [3.01, 0.12, 0.8],
    ];
    for (const [ratio, amp, decay] of partials) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = base * ratio * (1 + (Math.random() - 0.5) * 0.002);
      const a = amp * vel * 0.09;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(a, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
      o.connect(g).connect(master);
      o.start(t0);
      o.stop(t0 + decay + 0.1);
    }
  }

  // 鸣钟 n 记（约每 2.6 秒一记，如献堂礼）
  function toll(n = 3, base = 155.6) {
    ensure();
    for (let i = 0; i < n; i++) bell(base, 1 - i * 0.06, i * 2.6);
  }

  // 相机出入教堂时的声景切换
  function setInside(inside) {
    if (inside === insideNow) return;
    insideNow = inside;
    if (!ctx) return;
    const t = ctx.currentTime;
    windGain.gain.cancelScheduledValues(t);
    windGain.gain.linearRampToValueAtTime(inside ? 0.008 : 0.05, t + 1.6);
    padGain.gain.cancelScheduledValues(t);
    padGain.gain.linearRampToValueAtTime(inside ? 1 : 0, t + 2.2);
  }

  function toggleMute() {
    muted = !muted;
    if (ctx) master.gain.linearRampToValueAtTime(muted ? 0 : 0.8, ctx.currentTime + 0.2);
    return muted;
  }

  return { ensure, bell, toll, setInside, toggleMute };
}
