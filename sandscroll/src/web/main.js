// Browser runtime: the same show and music engine as the broadcaster, drawn to a canvas and
// played through Web Audio. Used for previews, the published artifact and OBS Browser Source.
import { Show } from '../core/show.js';
import { SCENES, PROGRAM, VISIT, EVERGREEN } from '../scenes/index.js';
import { MusicEngine } from '../music/engine.js';

const params = new URLSearchParams(location.search);
const HD = params.get('hd') === '1';
const WIDTH = HD ? 1920 : 1280;
const HEIGHT = HD ? 1080 : 720;
const AUTOPLAY = params.get('autoplay') === '1';
const SHOW_UI = params.get('ui') !== '0';

const canvasFactory = {
  create(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  },
};

const view = document.getElementById('view');
view.width = WIDTH;
view.height = HEIGHT;
const ctx = view.getContext('2d');
const startBtn = document.getElementById('start');
const sceneSelect = document.getElementById('scene');
const muteBtn = document.getElementById('mute');
const fsBtn = document.getElementById('fullscreen');
const nowPlaying = document.getElementById('now');

let show = null;
let music = null;
let audio = null;
let gain = null;
let image = null;
let last = 0;
let nextAudioTime = 0;
let muted = false;

// CJK web fonts are split by unicode-range, so request exactly the glyphs the scenes use.
async function loadFonts() {
  const texts = [];
  for (const s of Object.values(SCENES)) {
    if (s.poem) texts.push(s.poem.columns.join(''), s.poem.cn, s.poem.by);
    if (s.note) texts.push(s.note.cn);
    if (s.title) texts.push(s.title.cn);
    if (s.seal) texts.push(s.seal);
  }
  const all = [...new Set(texts.join(''))].join('');
  const loads = [
    document.fonts.load('64px "Zhi Mang Xing"', all),
    document.fonts.load('64px "Ma Shan Zheng"', all),
    document.fonts.load('30px "Cormorant Garamond"', 'Aa'),
    document.fonts.load('italic 30px "Cormorant Garamond"', 'Aa'),
  ];
  await Promise.race([Promise.allSettled(loads), new Promise((r) => setTimeout(r, 6000))]);
}

let pendingAudio = false;

function startAudio() {
  if (audio) return;
  if (!show) {
    pendingAudio = true;
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audio = new AC({ latencyHint: 'playback' });
  gain = audio.createGain();
  gain.gain.value = muted ? 0 : 1;
  gain.connect(audio.destination);
  const mood = show.scene?.music || SCENES[show.program[show.index % show.program.length]]?.music || 'moonrise';
  music = new MusicEngine({ sampleRate: audio.sampleRate, seed: show.seed, mood });
  nextAudioTime = audio.currentTime + 0.15;
  pumpAudio();
  setInterval(pumpAudio, 200);
}

// Keeps ~1.2 s of music scheduled ahead as gapless AudioBuffer chunks.
function pumpAudio() {
  if (!audio || !music) return;
  const chunk = Math.round(audio.sampleRate * 0.25);
  const left = new Float32Array(chunk);
  const right = new Float32Array(chunk);
  if (nextAudioTime < audio.currentTime) nextAudioTime = audio.currentTime + 0.05;
  while (nextAudioTime < audio.currentTime + 1.2) {
    music.setSandActivity(show.activity);
    music.renderInto(left, right);
    const buf = audio.createBuffer(2, chunk, audio.sampleRate);
    buf.copyToChannel(left, 0);
    buf.copyToChannel(right, 1);
    const src = audio.createBufferSource();
    src.buffer = buf;
    src.connect(gain);
    src.start(nextAudioTime);
    nextAudioTime += chunk / audio.sampleRate;
  }
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000 || 0);
  last = now;
  show.update(dt);
  const rects = show.render();
  for (const [x0, y0, x1, y1] of rects) ctx.putImageData(image, 0, 0, x0, y0, x1 - x0, y1 - y0);
  requestAnimationFrame(frame);
}

function begin(startIndex = 0) {
  const seed = Number(params.get('seed')) || Math.floor(Date.now() / 86400000);
  const program = params.get('program') ? params.get('program').split(',') : PROGRAM;
  show = new Show({ width: WIDTH, height: HEIGHT, seed, canvas: canvasFactory, program, start: startIndex, hold: 22 });
  image = new ImageData(show.frame, WIDTH, HEIGHT);
  ctx.putImageData(image, 0, 0);
  show.on((event, data) => {
    if (event === 'scene') {
      music?.setMood(data.music);
      if (nowPlaying) nowPlaying.textContent = `${data.title.cn} · ${data.title.en}`;
      if (sceneSelect) sceneSelect.value = data.id;
    } else if (event === 'cue') {
      music?.cue(data);
    }
  });
  last = performance.now();
  requestAnimationFrame(frame);
  if (pendingAudio) startAudio();
}

function populateProgram() {
  const list = document.getElementById('program');
  if (!list) return;
  const part = (text) => {
    const li = document.createElement('li');
    li.className = 'part';
    li.textContent = text;
    list.append(li);
  };
  const item = (id) => {
    const s = SCENES[id];
    const li = document.createElement('li');
    const b = document.createElement('b');
    b.textContent = s.title.cn;
    const span = document.createElement('span');
    span.textContent = s.title.en;
    const small = document.createElement('small');
    small.textContent = s.poem ? `${s.poem.cn} — ${s.poem.by.split('·').slice(-1)[0].trim()}` : 'Title card';
    span.append(small);
    li.append(b, span);
    list.append(li);
  };
  part('The visit programme');
  VISIT.forEach(item);
  part('Evergreen interludes');
  EVERGREEN.forEach(item);
}

function populateScenes() {
  if (!sceneSelect) return;
  for (const id of PROGRAM) {
    const s = SCENES[id];
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${s.title.cn} · ${s.title.en}`;
    sceneSelect.append(opt);
  }
  sceneSelect.addEventListener('change', () => {
    const idx = PROGRAM.indexOf(sceneSelect.value);
    if (idx < 0 || !show) return;
    // Jump: finish the current gesture queue and start the chosen scene next.
    show.stage.queue.length = 0;
    show.stage.current = null;
    show.index = idx + show.cycle * show.program.length;
  });
}

async function init() {
  document.body.classList.toggle('no-ui', !SHOW_UI);
  populateScenes();
  populateProgram();
  muteBtn?.addEventListener('click', () => {
    muted = !muted;
    if (gain) gain.gain.setTargetAtTime(muted ? 0 : 1, audio.currentTime, 0.1);
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
  });
  fsBtn?.addEventListener('click', () => {
    const el = document.querySelector('.stage') || document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.().catch(() => {});
  });
  // Browsers only allow sound after a click; the picture starts right away.
  startBtn?.addEventListener('click', () => {
    startAudio();
    document.body.classList.add('sound');
  }, { once: true });
  await loadFonts();
  begin(0);
  if (AUTOPLAY) {
    startAudio();
    document.body.classList.add('sound');
  }
}

init();
