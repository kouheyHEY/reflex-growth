export function evaluateReviewGate({ policy, automatedReview, humanReview }) {
  const blockers = [];
  if (policy?.mandatory !== true) blockers.push('Application review policy is not mandatory.');
  if (automatedReview?.status !== 'passed') blockers.push('Automated application review has blocking findings.');
  if (humanReview?.status !== 'completed') blockers.push('Human application review is incomplete.');
  if (!policy?.requiredDecisionForPublish?.includes(humanReview?.decision)) blockers.push('Human review decision does not allow publishing.');
  const requiredIds = new Set((policy?.categories || []).filter(item => item.required).map(item => item.id));
  const completedIds = new Set((humanReview?.categories || []).filter(item => item.result).map(item => item.id));
  const missing = [...requiredIds].filter(id => !completedIds.has(id));
  if (missing.length) blockers.push(`Required human review categories are incomplete: ${missing.join(', ')}`);
  return { allowed: blockers.length === 0, blockers };
}
