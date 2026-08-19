import test from 'node:test';
import assert from 'node:assert/strict';
import { HISTORY_LIMIT, MAX_WAIT_MS, MIN_WAIT_MS, REACTION_TIMEOUT_MS, advanceTime, averageReaction, createGameState, exportProgress, levelForXp, randomWaitMs, respond, respondAndContinue, restoreProgress, startTrial, xpForReaction } from '../src/engine.js';

test('random wait remains inside the declared range', () => {
  assert.equal(randomWaitMs(0), MIN_WAIT_MS);
  assert.ok(randomWaitMs(.999999) <= MAX_WAIT_MS);
});

test('signal appears only after the wait finishes', () => {
  const waiting = startTrial(createGameState(), 1000);
  assert.equal(advanceTime(waiting, 999).phase, 'waiting');
  const signal = advanceTime(waiting, 1000);
  assert.equal(signal.phase, 'signal');
  assert.equal(signal.signalElapsedMs, 0);
});

test('pressing before the signal is a false start', () => {
  const result = respond(startTrial(createGameState(), 1000), 'pointer_down');
  assert.equal(result.result.type, 'false_start');
  assert.equal(result.state.phase, 'false_start');
  assert.equal(result.state.trialCount, 1);
});

test('reaction response records raw milliseconds and rewards growth', () => {
  const signal = advanceTime(startTrial(createGameState(), 0), 0);
  const result = respond(advanceTime(signal, 212), 'pointer_down');
  assert.equal(result.result.reactionMs, 212);
  assert.equal(result.state.lastReactionMs, 212);
  assert.equal(result.state.xp, xpForReaction(212));
  assert.equal(result.state.streak, 1);
});

test('best and average use measured values without growth modifiers', () => {
  let state = createGameState();
  for (const ms of [310, 205, 260]) {
    state = respond(advanceTime(advanceTime(startTrial(state, 0), 0), ms), 'key_down').state;
  }
  assert.equal(state.bestReactionMs, 205);
  assert.equal(averageReaction(state.history), 258);
});

test('history is limited to the most recent ten successful trials', () => {
  let state = createGameState();
  for (let index = 0; index < HISTORY_LIMIT + 4; index += 1) state = respond(advanceTime(advanceTime(startTrial(state, 0), 0), 200 + index), 'pointer_down').state;
  assert.equal(state.history.length, HISTORY_LIMIT);
  assert.equal(state.history[0], 204);
});

test('missing the response window ends the trial and resets streak', () => {
  const base = { ...createGameState(), streak: 3 };
  const signal = advanceTime(startTrial(base, 0), 0);
  const missed = advanceTime(signal, REACTION_TIMEOUT_MS);
  assert.equal(missed.phase, 'missed');
  assert.equal(missed.streak, 0);
});

test('undeclared automatic response cannot complete a measurement', () => {
  const signal = advanceTime(startTrial(createGameState(), 0), 0);
  const result = respond(signal, 'system_signal');
  assert.equal(result.result, null);
  assert.equal(result.agencyViolation, 'player_commit_input_missing');
});

test('level is derived only from accumulated XP', () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(40), 2);
  assert.equal(levelForXp(100), 3);
});

test('growth progress can persist without restoring an in-progress trial', () => {
  const state = { ...createGameState(), phase: 'signal', xp: 180, level: 4, trialCount: 9, bestReactionMs: 188, history: [240, 188], bestStreak: 5 };
  const restored = restoreProgress(exportProgress(state));
  assert.equal(restored.phase, 'idle');
  assert.equal(restored.level, 4);
  assert.equal(restored.bestReactionMs, 188);
  assert.deepEqual(restored.history, [240, 188]);
});

test('successful reaction immediately starts the next wait without another input', () => {
  const signal = advanceTime(startTrial(createGameState(), 0), 0);
  const result = respondAndContinue(advanceTime(signal, 214), 'pointer_down', 1200);
  assert.equal(result.result.reactionMs, 214);
  assert.equal(result.continued, true);
  assert.equal(result.continuation.additionalInputRequired, false);
  assert.equal(result.state.phase, 'waiting');
  assert.equal(result.state.waitRemainingMs, 1200);
  assert.equal(result.state.lastReactionMs, 214);
  assert.equal(result.state.lastXpGain, 28);
});

test('failure outcomes stop for feedback instead of silently auto-continuing', () => {
  const result = respondAndContinue(startTrial(createGameState(), 1000), 'pointer_down', 1200);
  assert.equal(result.result.type, 'false_start');
  assert.equal(result.continued, false);
  assert.equal(result.state.phase, 'false_start');
});
