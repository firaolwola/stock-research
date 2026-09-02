import { runOfflineAdversarialEvaluation } from "../lib/offline-adversarial-evaluation.js";

const evaluation = await runOfflineAdversarialEvaluation();
console.log(JSON.stringify(evaluation, null, 2));
if (evaluation.summary.failed > 0 || evaluation.summary.holdout.passed !== evaluation.summary.holdout.total) process.exitCode = 1;
