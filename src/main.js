import { advanceTime, averageReaction, createGameState, exportProgress, growthStage, levelProgress, randomWaitMs, respondAndContinue, restoreProgress, startTrial } from './engine.js';
import { createEffects } from './effects.js';

const elements = {
  game: document.querySelector('#game'), zone: document.querySelector('#reaction-zone'), sound: document.querySelector('#sound-button'),
  level: document.querySelector('#level'), xpFill: document.querySelector('#xp-fill'), xpTrack: document.querySelector('.xp-track'), growthName: document.querySelector('#growth-name'),
  eyebrow: document.querySelector('#eyebrow'), label: document.querySelector('#state-label'), instruction: document.querySelector('#instruction'),
  last: document.querySelector('#last-time'), note: document.querySelector('#result-note'), best: document.querySelector('#best-time'), average: document.querySelector('#average-time'), streak: document.querySelector('#streak'), trials: document.querySelector('#trial-count')
};

const STORAGE_KEY = 'reflex-bloom-progress-v1';
function loadProgress() {
  try { return restoreProgress(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { return createGameState(); }
}
function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(exportProgress(state))); }
  catch { /* Persistence is optional when storage is unavailable. */ }
}

let state = loadProgress();
let previousTime = 0;
let soundEnabled = true;
let audioContext;
const effects = createEffects(document.querySelector('#effects'));

function formatMs(value) { return value === null ? '—' : `${value} ms`; }

function reactionGrade(ms) {
  if (ms <= 180) return ['LIGHTNING!', 1];
  if (ms <= 220) return ['EXCELLENT', .86];
  if (ms <= 280) return ['GREAT', .7];
  if (ms <= 350) return ['GOOD', .5];
  return ['KEEP GROWING', .35];
}

function syncUi() {
  elements.game.className = `game phase-${state.phase} growth-${growthStage(state.level).id}`;
  const progress = levelProgress(state.xp);
  elements.level.textContent = String(state.level);
  elements.xpFill.style.width = `${progress.ratio * 100}%`;
  elements.xpTrack.setAttribute('aria-valuenow', String(Math.round(progress.ratio * 100)));
  elements.growthName.textContent = growthStage(state.level).label;
  elements.last.textContent = formatMs(state.lastReactionMs);
  elements.best.textContent = formatMs(state.bestReactionMs);
  elements.average.textContent = formatMs(averageReaction(state.history));
  elements.streak.textContent = String(state.streak);
  elements.trials.textContent = `${state.trialCount} TRIAL${state.trialCount === 1 ? '' : 'S'}`;

  const copy = {
    idle: ['REACTION TRAINING', 'TAP TO START', '合図が光ったら、すぐタップ'],
    waiting: ['WAIT FOR THE LIGHT', 'WAIT…', 'まだ押さない'],
    signal: ['NOW', 'TAP!', '今すぐタップ'],
    result: ['REACTION RECORDED', formatMs(state.lastReactionMs), `+${state.lastXpGain} XP · タップでもう一度`],
    false_start: ['TOO EARLY', 'FALSE START', '焦らず合図を待とう · タップで再挑戦'],
    missed: ['SIGNAL MISSED', 'TOO SLOW', 'タップで再挑戦']
  }[state.phase];
  [elements.eyebrow.textContent, elements.label.textContent, elements.instruction.textContent] = copy;
  elements.note.textContent = state.phase === 'false_start'
    ? '合図より早い入力'
    : state.phase === 'missed'
      ? '1.6秒を超過'
      : state.lastOutcome === 'success'
        ? `${reactionGrade(state.lastReactionMs)[0]} · +${state.lastXpGain} XP`
        : '反応を記録します';
}

function tone(frequency, duration, type = 'sine', volume = .035, endFrequency = frequency) {
  if (!soundEnabled) return;
  try {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), audioContext.currentTime + duration);
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
  } catch { /* Audio is optional. */ }
}

function beginNextTrial() {
  state = startTrial(state, randomWaitMs());
  tone(180, .08, 'sine', .02, 110);
  syncUi();
}

function commit(trigger) {
  if (['idle', 'result', 'false_start', 'missed'].includes(state.phase)) { beginNextTrial(); return; }
  const previousLevel = state.level;
  const response = respondAndContinue(state, trigger, randomWaitMs());
  state = response.state;
  if (!response.result) return;
  if (response.result.type === 'false_start') {
    tone(115, .18, 'sawtooth', .035, 55);
    navigator.vibrate?.([25, 35, 25]);
  } else {
    const [, quality] = reactionGrade(response.result.reactionMs);
    effects.burst(quality);
    tone(360 + quality * 360, .16, 'sine', .04, 760 + quality * 280);
    navigator.vibrate?.(response.result.reactionMs <= 220 ? [16, 28, 20] : 18);
  }
  syncUi();
  saveProgress();
  if (response.result.type === 'success' && state.level > previousLevel) {
    elements.game.classList.add('level-up');
    window.setTimeout(() => elements.game.classList.remove('level-up'), 750);
    window.setTimeout(() => tone(880, .22, 'triangle', .035, 1320), 100);
  }
}

function frame(time) {
  const elapsed = Math.min(50, previousTime ? time - previousTime : 16);
  previousTime = time;
  const previousPhase = state.phase;
  state = advanceTime(state, elapsed);
  if (state.phase !== previousPhase) {
    if (state.phase === 'signal') { tone(720, .09, 'square', .04, 1080); navigator.vibrate?.(12); }
    if (state.phase === 'missed') { tone(90, .2, 'sawtooth', .03, 45); saveProgress(); }
    syncUi();
  }
  effects.update(elapsed);
  requestAnimationFrame(frame);
}

elements.zone.addEventListener('pointerdown', event => {
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  commit('pointer_down');
});
elements.zone.addEventListener('contextmenu', event => event.preventDefault());
window.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.repeat) return;
  event.preventDefault(); commit('key_down');
});
elements.sound.addEventListener('pointerdown', event => event.stopPropagation());
elements.sound.addEventListener('click', event => {
  event.stopPropagation(); soundEnabled = !soundEnabled;
  elements.sound.textContent = soundEnabled ? 'SOUND ON' : 'SOUND OFF';
  elements.sound.setAttribute('aria-pressed', String(soundEnabled));
});

new ResizeObserver(effects.resize).observe(elements.game);
effects.resize(); syncUi(); requestAnimationFrame(frame);
