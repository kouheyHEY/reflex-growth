import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REACTION_TIMEOUT_MS, advanceTime, averageReaction, createGameState, growthStage, respond, respondAndContinue, startTrial } from '../src/engine.js';
import { REACTION_RESPONSE_AGENCY_CONTRACT, RESULT_REENTRY_CONTRACT, SUCCESS_LOOP_CONTINUITY_CONTRACT } from '../src/interaction-contracts.js';
import { evaluateLoopContinuation, validateLoopContinuityContract } from '../src/loop-continuity.js';
import { evaluateActionCommit, validatePlayerAgencyContract } from '../src/player-agency.js';
import { canAcceptNextAction, validateResponsivenessContract } from '../src/responsiveness.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = name => readFile(path.join(root, 'automation', `${name}.json`), 'utf8').then(JSON.parse);
const [policy, agencyArtifact, responsivenessArtifact, continuityArtifact, gameSpec, pipeline] = await Promise.all([
  readJson('APP_REVIEW_POLICY'), readJson('PLAYER_AGENCY_CONTRACT'), readJson('RESPONSIVENESS_CONTRACT'), readJson('LOOP_CONTINUITY_CONTRACT'), readJson('GAME_SPEC'), readJson('PIPELINE_RUN')
]);
const [html, css, mainSource] = await Promise.all([
  readFile(path.join(root, 'index.html'), 'utf8'), readFile(path.join(root, 'styles.css'), 'utf8'), readFile(path.join(root, 'src', 'main.js'), 'utf8')
]);

let state = createGameState();
let invariantFailures = 0;
let falseStarts = 0;
let timeouts = 0;
let successes = 0;
for (let index = 0; index < 600; index += 1) {
  if (state.phase !== 'waiting') state = startTrial(state, 1000 + (index % 8) * 170);
  if (index % 17 === 0) {
    state = advanceTime(state, state.waitRemainingMs);
    state = advanceTime(state, REACTION_TIMEOUT_MS);
    timeouts += 1;
  } else if (index % 12 === 0) {
    state = respond(state, 'pointer_down').state;
    falseStarts += 1;
  } else {
    state = advanceTime(state, state.waitRemainingMs);
    state = advanceTime(state, 155 + (index % 9) * 43);
    state = respondAndContinue(state, index % 2 ? 'pointer_down' : 'key_down', 1000 + ((index + 1) % 8) * 170).state;
    successes += 1;
  }
  if (state.xp < 0 || state.level < 1 || state.history.length > 10 || (state.bestReactionMs !== null && state.bestReactionMs <= 0)) invariantFailures += 1;
}

const baseSignal = advanceTime(startTrial(createGameState(), 0), 0);
const grownSignal = { ...baseSignal, xp: 400, level: 6 };
const baseMeasurement = respond(advanceTime(baseSignal, 247), 'pointer_down').result.reactionMs;
const grownMeasurement = respond(advanceTime(grownSignal, 247), 'pointer_down').result.reactionMs;
const agencyPassed = validatePlayerAgencyContract(REACTION_RESPONSE_AGENCY_CONTRACT).valid
  && agencyArtifact.commitPolicy === REACTION_RESPONSE_AGENCY_CONTRACT.commitPolicy
  && evaluateActionCommit(REACTION_RESPONSE_AGENCY_CONTRACT, 'timer_elapsed').allowed === false
  && evaluateActionCommit(REACTION_RESPONSE_AGENCY_CONTRACT, 'pointer_down').allowed === true;
const responsivenessPassed = validateResponsivenessContract(RESULT_REENTRY_CONTRACT).valid
  && responsivenessArtifact.nextActionAvailabilityMs === 0
  && canAcceptNextAction(RESULT_REENTRY_CONTRACT, 0).allowed;
const measurementPassed = baseMeasurement === 247 && grownMeasurement === 247 && gameSpec.measurement.growthModifier === null;
const sourceChecks = {
  pointerInput: mainSource.includes("addEventListener('pointerdown'"), keyboardInput: mainSource.includes("addEventListener('keydown'"),
  audioFeedback: mainSource.includes('AudioContext'), vibrationFeedback: mainSource.includes('navigator.vibrate'),
  responsiveViewport: html.includes('viewport-fit=cover'), visibleInstructions: html.includes('合図が光ったら'),
  minimumSoundTarget: css.includes('min-height:44px'), landscapeLayout: css.includes('orientation:landscape'), reducedMotion: css.includes('prefers-reduced-motion'),
  automaticSuccessContinuation: mainSource.includes('respondAndContinue')
};
const continuitySignal = advanceTime(startTrial(createGameState(), 0), 0);
const continuityResult = respondAndContinue(advanceTime(continuitySignal, 247), 'pointer_down', 1300);
const failureContinuation = evaluateLoopContinuation(SUCCESS_LOOP_CONTINUITY_CONTRACT, { outcome: 'false_start', committedByPlayer: true });
const continuityPassed = validateLoopContinuityContract(SUCCESS_LOOP_CONTINUITY_CONTRACT).valid
  && continuityArtifact.continuationPolicy === SUCCESS_LOOP_CONTINUITY_CONTRACT.continuationPolicy
  && continuityArtifact.additionalInputRequired === false
  && continuityResult.continued === true
  && continuityResult.state.phase === 'waiting'
  && continuityResult.state.waitRemainingMs === 1300
  && failureContinuation.continue === false;
const automatedChecks = {
  engineInvariants: { status: invariantFailures ? 'failed' : 'passed', iterations: 600, failures: invariantFailures },
  stateCoverage: { status: falseStarts && timeouts && successes ? 'passed' : 'failed', successes, falseStarts, timeouts },
  measurementIntegrity: { status: measurementPassed ? 'passed' : 'failed', baselineMs: baseMeasurement, grownStateMs: grownMeasurement, growthModifier: null },
  growthReachability: { status: state.level >= 7 ? 'passed' : 'failed', reachedLevel: state.level, reachedStage: growthStage(state.level).id, xp: state.xp },
  rollingAverage: { status: state.history.length === 10 && averageReaction(state.history) !== null ? 'passed' : 'failed', sampleSize: state.history.length },
  playerAgency: { status: agencyPassed ? 'passed' : 'failed', readyConditionDoesNotCommit: true, declaredPlayerInputCommits: true },
  loopResponsiveness: { status: responsivenessPassed ? 'passed' : 'failed', nextActionAvailabilityMs: 0, resultPresentationBlocksInput: false },
  loopContinuity: {
    status: continuityPassed ? 'passed' : 'failed', additionalRestartInputsAfterSuccess: 0, continuationDelayMs: 0,
    nextState: continuityResult.state.phase, failureOutcomesAutoContinue: false,
    interpretation: '成功を確定した入力を継続意思として再利用し、新しい判断を伴わない次待機を自動開始する。'
  },
  sourceCoverage: { status: Object.values(sourceChecks).every(Boolean) ? 'passed' : 'failed', checks: sourceChecks },
  browserVisualReview: { status: 'needs_human_review', reason: '複数実画面幅と端末入力遅延は人レビューで確認する。' },
  marketFit: { status: 'not_evaluated', reason: '市場調査未実行' }
};
const blockingAutomated = Object.values(automatedChecks).some(check => check.status === 'failed') || !continuityPassed;
const findings = [
  { id: 'device-latency-variance', category: 'measurement_integrity', severity: 'medium', status: 'needs_human_review', description: 'ブラウザ、ディスプレイ、タッチ端末の遅延差が実測値へ影響する。絶対的な医学的測定値として扱わない。', automationDisposition: 'human_review_required' },
  { id: 'wait-tension-unverified', category: 'fun_loop', severity: 'high', status: 'needs_human_review', description: '900〜2600msの待機が緊張感になるか、退屈や苛立ちになるかは試遊が必要。', automationDisposition: 'human_review_required' },
  { id: 'growth-feel-unverified', category: 'growth_integrity', severity: 'high', status: 'needs_human_review', description: '数値・名称・光表現の変化が十分な成長実感になるかは試遊が必要。', automationDisposition: 'human_review_required' },
  { id: 'audio-visual-comfort-unverified', category: 'audio_quality', severity: 'medium', status: 'needs_human_review', description: '強い発光と短い反復音の快適性は人による視聴確認が必要。', automationDisposition: 'human_review_required' }
];
const status = blockingAutomated ? 'failed' : 'passed';
const result = {
  schemaVersion: '1.0', kind: 'automated-application-review', reviewedOn: '2026-08-19', policy: 'APP_REVIEW_POLICY.json', status,
  automatedChecks, findings,
  humanReviewRequired: policy.categories.filter(category => category.required).map(category => category.id),
  releaseRecommendation: status === 'passed' ? 'human_review_required' : 'changes_required'
};
const tasks = {
  schemaVersion: '1.0', kind: 'review-remediation-tasks', generatedFrom: 'AUTOMATED_APP_REVIEW.json',
  tasks: findings.filter(finding => finding.automationDisposition === 'generate_implementation_task').map((finding, index) => ({
    id: `review-task-${String(index + 1).padStart(2, '0')}`, findingId: finding.id, category: finding.category,
    priority: finding.severity === 'high' ? 'high' : 'medium', action: finding.automationDisposition, status: 'queued',
    acceptanceCriteria: `「${finding.description}」を解消し、既存の測定整合性を維持する。`
  }))
};
const evaluation = {
  schemaVersion: '1.0', kind: 'evaluation-result', evaluatedOn: '2026-08-19',
  automatedEvaluation: { status, checks: Object.entries(automatedChecks).map(([id, value]) => ({ id, ...value })) },
  humanEvaluation: { status: 'pending', artifact: 'HUMAN_APP_REVIEW.json', requiresReplacementBeforePublish: true },
  criticalIssues: blockingAutomated ? ['automated_review_failure'] : [], requiresHumanReview: true, recommendation: 'human_playtest'
};
const updatedPipeline = {
  ...pipeline, status: status === 'passed' ? 'waiting_for_human_review' : 'changes_required',
  stages: pipeline.stages.map(stage => stage.id === 'automated_evaluation' ? { ...stage, status: status === 'passed' ? 'completed' : 'failed' } : stage)
};

await Promise.all([
  writeFile(path.join(root, 'automation', 'AUTOMATED_APP_REVIEW.json'), `${JSON.stringify(result, null, 2)}\n`),
  writeFile(path.join(root, 'automation', 'REVIEW_REMEDIATION_TASKS.json'), `${JSON.stringify(tasks, null, 2)}\n`),
  writeFile(path.join(root, 'automation', 'EVALUATION_RESULT.json'), `${JSON.stringify(evaluation, null, 2)}\n`),
  writeFile(path.join(root, 'automation', 'PIPELINE_RUN.json'), `${JSON.stringify(updatedPipeline, null, 2)}\n`)
]);
console.log(`Automated app review: ${status}. ${successes} successful trials simulated; human review remains mandatory.`);
if (status !== 'passed') process.exitCode = 2;
