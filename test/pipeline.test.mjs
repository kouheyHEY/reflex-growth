import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = name => readFile(new URL(`../automation/${name}.json`, import.meta.url), 'utf8').then(JSON.parse);

test('rough user input remains distinct from generated decisions', async () => {
  const [brief, decisions] = await Promise.all([load('USER_BRIEF'), load('DESIGN_DECISIONS')]);
  assert.equal(brief.inputGranularity, 'rough');
  assert.equal(brief.theme.sourceType, 'USER_INPUT');
  assert.ok(decisions.decisions.every(item => ['RECOMMENDATION', 'ESTIMATE'].includes(item.sourceType)));
  assert.ok(decisions.decisions.every(item => item.reason));
});

test('research is not invented to justify the game', async () => {
  const research = await load('RESEARCH_STATUS');
  assert.equal(research.status, 'not_run');
  assert.deepEqual(research.facts, []);
});

test('measurement and growth are structurally separated', async () => {
  const spec = await load('GAME_SPEC');
  assert.equal(spec.measurement.unit, 'milliseconds');
  assert.equal(spec.measurement.growthModifier, null);
});

test('reused agency and responsiveness contracts are game-specific instances', async () => {
  const [agency, responsiveness] = await Promise.all([load('PLAYER_AGENCY_CONTRACT'), load('RESPONSIVENESS_CONTRACT')]);
  assert.equal(agency.id, 'reaction_response');
  assert.equal(agency.commitPolicy, 'player_input_required');
  assert.equal(responsiveness.id, 'result_to_next_trial');
  assert.equal(responsiveness.nextActionAvailabilityMs, 0);
});

test('human review and publication remain closed', async () => {
  const [policy, human, preview] = await Promise.all([load('APP_REVIEW_POLICY'), load('HUMAN_APP_REVIEW'), load('PUBLISH_PREVIEW')]);
  assert.equal(policy.mandatory, true);
  assert.equal(human.status, 'pending');
  assert.equal(preview.autoPublishEnabled, false);
  assert.equal(preview.publishGate.canPublish, false);
});
