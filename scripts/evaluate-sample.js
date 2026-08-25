import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateSample, validateEvaluationSet } from "../lib/evaluation.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const loadJson = async (...segments) => JSON.parse(await readFile(path.join(root, ...segments), "utf8"));
const evaluationSet = await loadJson("evaluation", "cases.json");
const samplePath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(root, "evaluation", "samples", "mock-results.json");
const sample = JSON.parse(await readFile(samplePath, "utf8"));
const validation = validateEvaluationSet(evaluationSet);

if (!validation.valid) {
  console.error("Evaluation set is invalid:");
  validation.errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(evaluateSample(evaluationSet, sample), null, 2));
}
