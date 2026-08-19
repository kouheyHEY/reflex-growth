import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReviewGate } from '../scripts/review-gate.mjs';

const policy = { mandatory: true, requiredDecisionForPublish: ['approved'], categories: [{ id: 'fun_loop', required: true }, { id: 'measurement_integrity', required: true }] };

test('gate blocks incomplete human review', () => {
  const result = evaluateReviewGate({ policy, automatedReview: { status: 'passed' }, humanReview: { status: 'pending', decision: null, categories: [] } });
  assert.equal(result.allowed, false);
});

test('gate blocks automated failures', () => {
  const humanReview = { status: 'completed', decision: 'approved', categories: [{ id: 'fun_loop', result: 'passed' }, { id: 'measurement_integrity', result: 'passed' }] };
  assert.equal(evaluateReviewGate({ policy, automatedReview: { status: 'failed' }, humanReview }).allowed, false);
});

test('gate passes only complete evidence', () => {
  const humanReview = { status: 'completed', decision: 'approved', categories: [{ id: 'fun_loop', result: 'passed' }, { id: 'measurement_integrity', result: 'passed' }] };
  assert.equal(evaluateReviewGate({ policy, automatedReview: { status: 'passed' }, humanReview }).allowed, true);
});
