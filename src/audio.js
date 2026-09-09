// 声音：Web Audio 全合成，无音频文件。
// 钟声用非谐泛音列合成（真实教堂钟的 hum / prime / tierce / quint / nominal），
// 室外是风与鸟，走进堂内自动安静下来、浮起极轻的圣咏式和声垫。
// 浏览器要求用户手势后才能出声：首次点击 / 按键时调用 ensure()。

export function createAudio(opts = {}) {
  // makeContext 可注入（离线测试传入 OfflineAudioContext）；offline 模式跳过 resume。
  const makeContext = opts.makeContext ||
    (() => new (window.AudioContext || window.webkitAudioContext)());
  let ctx = null;
  let master = null, windGain = null, padGain = null;
  let reverb = null, wetGain = null;
  let birdTimer = 0;
  let muted = false;
  let insideNow = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      return;
    }
    ctx = makeContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);

    // 教堂混响：合成的指数衰减噪声脉冲响应（约 2.8 秒——石头空间的余响）
    const rlen = Math.floor(ctx.sampleRate * 2.8);
    const impulse = ctx.createBuffer(2, rlen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = impulse.getChannelData(ch);
      for (let i = 0; i < rlen; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-3.2 * (i / rlen));
      }
    }
    reverb = ctx.createConvolver();
    reverb.buffer = impulse;
    wetGain = ctx.createGain();
    wetGain.gain.value = 0.45;
    reverb.connect(wetGain).connect(master);

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

  // 开关门：木门的吱呀是"粘滑"摩擦——门轴一边卡住一边松脱，听感是一条抖着往下滑的
  // 带噪音高。用白噪声过一个 Q 很高的带通模拟：带通中心频率往下滑，再叠一点抖动。
  // 关门收尾加一记闷响（门扇撞门框 + 落栓）。大扇比便门低沉、长一些。
  function door(opening = true, big = true) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const dur = big ? 1.15 : 0.7;
    const n = ctx.createBufferSource();
    const len = Math.ceil(ctx.sampleRate * (dur + 0.4));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = big ? 14 : 9;
    const f0 = big ? 620 : 900, f1 = big ? 300 : 480;
    bp.frequency.setValueAtTime(opening ? f0 : f1, t0);
    bp.frequency.exponentialRampToValueAtTime(opening ? f1 : f0, t0 + dur);
    const lfo = ctx.createOscillator();          // 粘滑的抖动
    lfo.frequency.value = big ? 11 : 17;
    const lfoG = ctx.createGain();
    lfoG.gain.value = big ? 90 : 60;
    lfo.connect(lfoG).connect(bp.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(big ? 0.05 : 0.035, t0 + 0.12);
    g.gain.setValueAtTime(big ? 0.05 : 0.035, t0 + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0004, t0 + dur);
    n.connect(bp).connect(g);
    g.connect(master); g.connect(reverb);
    n.start(t0); n.stop(t0 + dur + 0.05);
    lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    if (!opening) {                              // 关到位的闷响
      const t1 = t0 + dur;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(big ? 82 : 120, t1);
      o.frequency.exponentialRampToValueAtTime(big ? 46 : 70, t1 + 0.2);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0, t1);
      og.gain.linearRampToValueAtTime(big ? 0.16 : 0.09, t1 + 0.012);
      og.gain.exponentialRampToValueAtTime(0.0002, t1 + 0.5);
      o.connect(og); og.connect(master); og.connect(reverb);
      o.start(t1); o.stop(t1 + 0.55);
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
      g.connect(master);
      g.connect(reverb);
      o.connect(g);
      o.start(t0);
      o.stop(t0 + decay + 0.1);
    }
  }

  // 管风琴单音：主音管（principal）音色 = 基频 + 前几阶泛音，起音带一点"气声"（chiff）
  function organNote(freq, when, dur, vel = 1) {
    const t0 = ctx.currentTime + when;
    const out = ctx.createGain();
    out.connect(master);
    out.connect(reverb);
    for (const [ratio, amp] of [[1, 1], [2, 0.5], [3, 0.28], [4, 0.16], [6, 0.07]]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq * ratio * (1 + (Math.random() - 0.5) * 0.0015);
      const a = amp * vel * 0.1;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(a * 1.25, t0 + 0.025);   // chiff
      g.gain.linearRampToValueAtTime(a, t0 + 0.09);
      g.gain.setValueAtTime(a, t0 + dur);
      g.gain.linearRampToValueAtTime(0, t0 + dur + 0.28);
      o.connect(g).connect(out);
      o.start(t0);
      o.stop(t0 + dur + 0.35);
    }
  }

  // 巴赫《d 小调托卡塔与赋格》BWV 565 开头（公版乐谱，自合成音色）
  function playToccata() {
    ensure();
    const N = {
      A5: 880, G5: 783.99, F5: 698.46, E5: 659.26, D5: 587.33, Cs5: 554.37,
      A4: 440, G4: 392, F4: 349.23, E4: 329.63, D4: 293.66, Cs4: 277.18,
      D3: 146.83, A3: 220, F3: 174.61, D2: 73.42,
    };
    const phrase = (oct, t) => {
      const n = (name) => N[name] / (oct ? 2 : 1);
      organNote(n('A5'), t, 0.28); t += 0.3;
      organNote(n('G5'), t, 0.12); t += 0.13;
      organNote(n('A5'), t, 1.0); t += 1.35;
      organNote(n('G5'), t, 0.13); t += 0.14;
      organNote(n('F5'), t, 0.13); t += 0.14;
      organNote(n('E5'), t, 0.13); t += 0.14;
      organNote(n('D5'), t, 0.13); t += 0.14;
      organNote(n('Cs5'), t, 0.42); t += 0.5;
      organNote(n('D5'), t, 1.5); t += 2.0;
      return t;
    };
    let t = 0.1;
    t = phrase(0, t);          // 高八度
    t = phrase(1, t + 0.15);   // 低八度回声
    // 终止：D 大调长和弦压上踏板音
    organNote(N.D2, t, 3.6, 1.3);
    for (const f of [N.D3, N.A3, N.D4, N.F4 * Math.pow(2, 1 / 12)]) {  // F#4
      organNote(f, t + 0.12, 3.4, 0.85);
    }
    return t + 4.2;
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

  return { ensure, bell, toll, door, setInside, toggleMute, playToccata };
}
