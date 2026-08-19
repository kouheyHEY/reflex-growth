import { REACTION_RESPONSE_AGENCY_CONTRACT, SUCCESS_LOOP_CONTINUITY_CONTRACT } from './interaction-contracts.js';
import { evaluateActionCommit } from './player-agency.js';
import { evaluateLoopContinuation } from './loop-continuity.js';

export const MIN_WAIT_MS = 900;
export const MAX_WAIT_MS = 2600;
export const REACTION_TIMEOUT_MS = 1600;
export const HISTORY_LIMIT = 10;

const LEVEL_THRESHOLDS = [0, 40, 100, 180, 280, 400, 550, 730];

export function levelForXp(xp) {
  const safeXp = Math.max(0, xp);
  const known = LEVEL_THRESHOLDS.findLastIndex(value => safeXp >= value) + 1;
  if (known < LEVEL_THRESHOLDS.length) return known;
  return LEVEL_THRESHOLDS.length + Math.floor((safeXp - LEVEL_THRESHOLDS.at(-1)) / 220);
}

export function levelProgress(xp) {
  const level = levelForXp(xp);
  const start = level <= LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[level - 1] : LEVEL_THRESHOLDS.at(-1) + (level - LEVEL_THRESHOLDS.length) * 220;
  const end = level < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[level] : start + 220;
  return { level, current: xp - start, required: end - start, ratio: Math.min(1, (xp - start) / (end - start)) };
}

export function growthStage(level) {
  if (level <= 2) return { id: 'seed', label: 'SEED LIGHT' };
  if (level <= 4) return { id: 'sprout', label: 'SPROUT LIGHT' };
  if (level <= 6) return { id: 'bloom', label: 'BLOOM LIGHT' };
  return { id: 'nova', label: 'NOVA LIGHT' };
}

export function xpForReaction(reactionMs) {
  if (reactionMs <= 180) return 35;
  if (reactionMs <= 220) return 28;
  if (reactionMs <= 280) return 22;
  if (reactionMs <= 350) return 16;
  if (reactionMs <= 500) return 12;
  return 8;
}

export function createGameState() {
  return { phase: 'idle', waitRemainingMs: 0, signalElapsedMs: 0, trialCount: 0, lastOutcome: null, lastReactionMs: null, bestReactionMs: null, history: [], xp: 0, level: 1, streak: 0, bestStreak: 0, lastXpGain: 0 };
}

export function exportProgress(state) {
  return { version: 1, xp: state.xp, trialCount: state.trialCount, bestReactionMs: state.bestReactionMs, history: state.history.slice(-HISTORY_LIMIT), bestStreak: state.bestStreak };
}

export function restoreProgress(saved) {
  const base = createGameState();
  if (!saved || saved.version !== 1) return base;
  const xp = Number.isFinite(saved.xp) ? Math.max(0, Math.round(saved.xp)) : 0;
  const history = Array.isArray(saved.history) ? saved.history.filter(value => Number.isFinite(value) && value > 0).slice(-HISTORY_LIMIT) : [];
  const bestReactionMs = Number.isFinite(saved.bestReactionMs) && saved.bestReactionMs > 0 ? Math.round(saved.bestReactionMs) : (history.length ? Math.min(...history) : null);
  return { ...base, xp, level: levelForXp(xp), trialCount: Number.isFinite(saved.trialCount) ? Math.max(0, Math.round(saved.trialCount)) : 0, bestReactionMs, history, bestStreak: Number.isFinite(saved.bestStreak) ? Math.max(0, Math.round(saved.bestStreak)) : 0 };
}

export function randomWaitMs(randomValue = Math.random()) {
  const normalized = Math.max(0, Math.min(0.999999, randomValue));
  return Math.round(MIN_WAIT_MS + normalized * (MAX_WAIT_MS - MIN_WAIT_MS));
}

export function startTrial(state, waitMs = randomWaitMs()) {
  if (!['idle', 'result', 'false_start', 'missed'].includes(state.phase)) return state;
  return { ...state, phase: 'waiting', waitRemainingMs: Math.max(0, waitMs), signalElapsedMs: 0 };
}

export function advanceTime(state, elapsedMs) {
  const elapsed = Math.max(0, elapsedMs);
  if (state.phase === 'waiting') {
    if (elapsed < state.waitRemainingMs) return { ...state, waitRemainingMs: state.waitRemainingMs - elapsed };
    return { ...state, phase: 'signal', waitRemainingMs: 0, signalElapsedMs: elapsed - state.waitRemainingMs };
  }
  if (state.phase === 'signal') {
    const signalElapsedMs = state.signalElapsedMs + elapsed;
    if (signalElapsedMs >= REACTION_TIMEOUT_MS) return { ...state, phase: 'missed', signalElapsedMs: REACTION_TIMEOUT_MS, trialCount: state.trialCount + 1, lastOutcome: 'missed', streak: 0, lastXpGain: 0 };
    return { ...state, signalElapsedMs };
  }
  return state;
}

export function respond(state, commitTrigger) {
  const agency = evaluateActionCommit(REACTION_RESPONSE_AGENCY_CONTRACT, commitTrigger);
  if (!agency.allowed) return { state, result: null, agencyViolation: agency.violation };
  if (state.phase === 'waiting') {
    return { state: { ...state, phase: 'false_start', trialCount: state.trialCount + 1, lastOutcome: 'false_start', streak: 0, lastXpGain: 0 }, result: { type: 'false_start' } };
  }
  if (state.phase !== 'signal') return { state, result: null };

  const reactionMs = Math.max(1, Math.round(state.signalElapsedMs));
  const xpGain = xpForReaction(reactionMs);
  const xp = state.xp + xpGain;
  const level = levelForXp(xp);
  const history = [...state.history, reactionMs].slice(-HISTORY_LIMIT);
  const streak = state.streak + 1;
  return {
    state: {
      ...state, phase: 'result', trialCount: state.trialCount + 1, lastOutcome: 'success', lastReactionMs: reactionMs,
      bestReactionMs: state.bestReactionMs === null ? reactionMs : Math.min(state.bestReactionMs, reactionMs),
      history, xp, level, streak, bestStreak: Math.max(state.bestStreak, streak), lastXpGain: xpGain
    },
    result: { type: 'success', reactionMs, xpGain, levelUp: level > state.level }
  };
}

export function respondAndContinue(state, commitTrigger, nextWaitMs = randomWaitMs()) {
  const response = respond(state, commitTrigger);
  if (!response.result) return { ...response, continued: false };
  const continuation = evaluateLoopContinuation(SUCCESS_LOOP_CONTINUITY_CONTRACT, { outcome: response.result.type, committedByPlayer: !response.agencyViolation });
  if (!continuation.continue) return { ...response, continued: false, continuation };
  return {
    ...response,
    completedState: response.state,
    state: startTrial(response.state, nextWaitMs),
    continued: true,
    continuation
  };
}

export function averageReaction(history) {
  if (!history.length) return null;
  return Math.round(history.reduce((sum, value) => sum + value, 0) / history.length);
}
