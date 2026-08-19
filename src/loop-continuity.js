export function validateLoopContinuityContract(contract) {
  const errors = [];
  if (!contract?.id) errors.push('id is required');
  if (!Array.isArray(contract?.continuingOutcomes) || contract.continuingOutcomes.length === 0) errors.push('continuingOutcomes are required');
  if (!contract?.nextLoopState) errors.push('nextLoopState is required');
  if (!['reuse_committing_input', 'manual_restart'].includes(contract?.continuationPolicy)) errors.push('continuationPolicy is invalid');
  if (!Number.isFinite(contract?.continuationDelayMs) || contract.continuationDelayMs < 0) errors.push('continuationDelayMs must be zero or greater');
  if (contract?.continuationPolicy === 'reuse_committing_input' && contract.additionalInputRequired !== false) errors.push('reuse_committing_input cannot require another input');
  if (contract?.continuationPolicy === 'reuse_committing_input' && contract.newDecisionRequired !== false) errors.push('automatic continuation requires no new player decision');
  return { valid: errors.length === 0, errors };
}

export function evaluateLoopContinuation(contract, { outcome, committedByPlayer }) {
  const validation = validateLoopContinuityContract(contract);
  if (!validation.valid) return { continue: false, violation: 'invalid_loop_continuity_contract', errors: validation.errors };
  if (!contract.continuingOutcomes.includes(outcome)) return { continue: false, reason: 'outcome_requires_separate_handling' };
  if (contract.continuationPolicy === 'reuse_committing_input' && !committedByPlayer) return { continue: false, violation: 'player_commit_required_for_reuse' };
  return { continue: contract.continuationPolicy === 'reuse_committing_input', additionalInputRequired: contract.additionalInputRequired, delayMs: contract.continuationDelayMs };
}
