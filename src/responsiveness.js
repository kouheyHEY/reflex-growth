export function validateResponsivenessContract(contract) {
  const errors = [];
  if (!contract?.id) errors.push('id is required');
  if (!contract?.nextAction) errors.push('nextAction is required');
  if (!Number.isFinite(contract?.nextActionAvailabilityMs) || contract.nextActionAvailabilityMs < 0) errors.push('nextActionAvailabilityMs must be zero or greater');
  if (!['blocking', 'non_blocking'].includes(contract?.outcomePresentationPolicy)) errors.push('outcomePresentationPolicy is invalid');
  if (contract?.outcomePresentationPolicy === 'non_blocking' && contract?.nextActionAvailabilityMs > 0) errors.push('non_blocking presentation requires immediate next-action availability');
  return { valid: errors.length === 0, errors };
}

export function canAcceptNextAction(contract, elapsedSinceOutcomeMs) {
  const validation = validateResponsivenessContract(contract);
  if (!validation.valid) return { allowed: false, violation: 'invalid_responsiveness_contract', errors: validation.errors };
  return { allowed: Math.max(0, elapsedSinceOutcomeMs) >= contract.nextActionAvailabilityMs, remainingMs: Math.max(0, contract.nextActionAvailabilityMs - Math.max(0, elapsedSinceOutcomeMs)) };
}
