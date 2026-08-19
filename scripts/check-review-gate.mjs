import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateReviewGate } from './review-gate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = name => readFile(path.join(root, 'automation', `${name}.json`), 'utf8').then(JSON.parse);
const [policy, automatedReview, humanReview] = await Promise.all([load('APP_REVIEW_POLICY'), load('AUTOMATED_APP_REVIEW'), load('HUMAN_APP_REVIEW')]);
const result = evaluateReviewGate({ policy, automatedReview, humanReview });
if (result.allowed) console.log('Application review gate passed.');
else { console.error(`Application review gate blocked:\n- ${result.blockers.join('\n- ')}`); process.exitCode = 1; }
