export const COMMIT_POLICIES = Object.freeze({ PLAYER_INPUT_REQUIRED: 'player_input_required', AUTOMATIC_ALLOWED: 'automatic_allowed' });

export function validatePlayerAgencyContract(contract) {
  const errors = [];
  if (!contract?.id) errors.push('id is required');
  if (!Object.values(COMMIT_POLICIES).includes(contract?.commitPolicy)) errors.push('commitPolicy is invalid');
  if (!Array.isArray(contract?.commitTriggers) || contract.commitTriggers.length === 0) errors.push('commitTriggers are required');
  if (contract?.commitPolicy === COMMIT_POLICIES.PLAYER_INPUT_REQUIRED && contract.automaticCommitAllowed) errors.push('player_input_required cannot allow automatic commit');
  if (contract?.commitPolicy === COMMIT_POLICIES.AUTOMATIC_ALLOWED && contract.automaticCommitAllowed !== true) errors.push('automaticCommitAllowed must be true');
  if (contract?.commitPolicy === COMMIT_POLICIES.AUTOMATIC_ALLOWED && !contract.automaticCommitReason) errors.push('automaticCommitReason is required');
  return { valid: errors.length === 0, errors };
}

export function evaluateActionCommit(contract, trigger) {
  const validation = validatePlayerAgencyContract(contract);
  if (!validation.valid) return { allowed: false, violation: 'invalid_agency_contract', errors: validation.errors };
  if (!contract.commitTriggers.includes(trigger)) return { allowed: false, violation: contract.commitPolicy === COMMIT_POLICIES.PLAYER_INPUT_REQUIRED ? 'player_commit_input_missing' : 'undeclared_commit_trigger' };
  return { allowed: true, violation: null };
}
