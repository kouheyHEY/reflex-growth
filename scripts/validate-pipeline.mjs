import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const names = ['USER_BRIEF','RESEARCH_STATUS','DESIGN_DECISIONS','GAME_SPEC','IMPLEMENTATION_TASK','PLAYER_AGENCY_CONTRACT','RESPONSIVENESS_CONTRACT','APP_REVIEW_POLICY','HUMAN_APP_REVIEW','EVALUATION_PLAN','BROWSER_REVIEW_EVIDENCE','AUTOMATED_APP_REVIEW','REVIEW_REMEDIATION_TASKS','EVALUATION_RESULT','PUBLISH_PREVIEW','PIPELINE_RUN'];
const artifacts = Object.fromEntries(await Promise.all(names.map(async name => [name, JSON.parse(await readFile(path.join(root, 'automation', `${name}.json`), 'utf8'))])));
const failures = [];
if (artifacts.USER_BRIEF.theme.sourceType !== 'USER_INPUT' || artifacts.USER_BRIEF.inputGranularity !== 'rough') failures.push('Rough user theme provenance is missing.');
if (artifacts.RESEARCH_STATUS.status !== 'not_run' || artifacts.RESEARCH_STATUS.facts.length) failures.push('Unverified research must remain empty.');
if (!artifacts.DESIGN_DECISIONS.decisions.every(item => item.sourceType && item.reason)) failures.push('Design decisions need provenance and reasons.');
if (artifacts.GAME_SPEC.marketRationale.status !== 'unknown') failures.push('Market rationale must remain unknown.');
if (artifacts.GAME_SPEC.measurement.growthModifier !== null) failures.push('Growth must not modify raw reaction time.');
if (!artifacts.IMPLEMENTATION_TASK.acceptanceCriteria.length) failures.push('Acceptance criteria are required.');
if (artifacts.PLAYER_AGENCY_CONTRACT.commitPolicy !== 'player_input_required' || artifacts.PLAYER_AGENCY_CONTRACT.automaticCommitAllowed !== false) failures.push('Reaction measurement must require player input.');
if (artifacts.RESPONSIVENESS_CONTRACT.nextActionAvailabilityMs !== 0) failures.push('Next trial must be immediately available.');
if (!artifacts.APP_REVIEW_POLICY.categories.some(item => item.id === 'measurement_integrity' && item.required)) failures.push('Measurement integrity review must be required.');
if (!artifacts.APP_REVIEW_POLICY.categories.some(item => item.id === 'growth_integrity' && item.required)) failures.push('Growth integrity review must be required.');
if (artifacts.HUMAN_APP_REVIEW.status !== 'pending') failures.push('Human review must remain pending until completed by a reviewer.');
if (!artifacts.EVALUATION_PLAN.humanChecks.every(item => item.requiresHumanReview)) failures.push('Subjective checks require human review.');
if (artifacts.AUTOMATED_APP_REVIEW.status !== 'passed') failures.push('Automated review must pass before playtest.');
if (artifacts.EVALUATION_RESULT.humanEvaluation.status !== 'pending') failures.push('Human evaluation cannot be assumed.');
if (artifacts.PUBLISH_PREVIEW.autoPublishEnabled !== false || artifacts.PUBLISH_PREVIEW.publishGate.canPublish !== false) failures.push('Publish gate must default closed.');
if (artifacts.PIPELINE_RUN.stages.find(stage => stage.id === 'publish').status !== 'waiting_for_user') failures.push('Publishing must wait for user approval.');
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(`Validated ${names.length} pipeline artifacts.`);
