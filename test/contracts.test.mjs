import test from 'node:test';
import assert from 'node:assert/strict';
import { REACTION_RESPONSE_AGENCY_CONTRACT, RESULT_REENTRY_CONTRACT } from '../src/interaction-contracts.js';
import { evaluateActionCommit, validatePlayerAgencyContract } from '../src/player-agency.js';
import { canAcceptNextAction, validateResponsivenessContract } from '../src/responsiveness.js';

test('reaction response requires explicit player input', () => {
  assert.equal(validatePlayerAgencyContract(REACTION_RESPONSE_AGENCY_CONTRACT).valid, true);
  assert.equal(evaluateActionCommit(REACTION_RESPONSE_AGENCY_CONTRACT, 'pointer_down').allowed, true);
  assert.equal(evaluateActionCommit(REACTION_RESPONSE_AGENCY_CONTRACT, 'timer_elapsed').allowed, false);
});

test('result presentation does not block the next trial', () => {
  assert.equal(validateResponsivenessContract(RESULT_REENTRY_CONTRACT).valid, true);
  assert.equal(canAcceptNextAction(RESULT_REENTRY_CONTRACT, 0).allowed, true);
});

test('hidden delay invalidates a non-blocking result contract', () => {
  assert.equal(validateResponsivenessContract({ ...RESULT_REENTRY_CONTRACT, nextActionAvailabilityMs: 300 }).valid, false);
});
