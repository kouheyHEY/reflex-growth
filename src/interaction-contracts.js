import { COMMIT_POLICIES } from './player-agency.js';

export const REACTION_RESPONSE_AGENCY_CONTRACT = Object.freeze({
  schemaVersion: '1.0', id: 'reaction_response', actionCategory: 'primary_action', criticalAction: true,
  readyCondition: 'visual_signal_visible', commitPolicy: COMMIT_POLICIES.PLAYER_INPUT_REQUIRED,
  commitTriggers: ['pointer_down', 'key_down'], automaticCommitAllowed: false, feedbackRequired: true
});

export const RESULT_REENTRY_CONTRACT = Object.freeze({
  schemaVersion: '1.0', id: 'result_to_next_trial', outcome: 'reaction_result_shown', nextAction: 'start_next_trial',
  nextActionAvailabilityMs: 0, outcomePresentationPolicy: 'non_blocking', presentationMayOverlapNextAction: true,
  inputBufferPolicy: 'not_required_because_result_state_accepts_input'
});
