import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export class EvaluationPlanError extends Error {
  constructor(safeReason, detail = null) {
    super(safeReason);
    this.name = "EvaluationPlanError";
    this.code = safeReason;
    this.safe_reason = safeReason;
    this.detail = detail;
  }
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const inheritanceReference = (plan) => plan.parent_plan ?? plan.base_plan ?? null;
const inheritanceHash = (plan) => plan.parent_plan ? plan.parent_plan_sha256 : plan.base_plan ? plan.base_plan_sha256 : null;

function mergeResolved(base, override, source, provenance, prefix = "") {
  const result = structuredClone(base ?? {});
  for (const [key, value] of Object.entries(override ?? {})) {
    const field = prefix ? `${prefix}.${key}` : key;
    if (isObject(value) && isObject(result[key])) result[key] = mergeResolved(result[key], value, source, provenance, field);
    else if (isObject(value)) {
      for (const existing of Object.keys(provenance)) if (existing === field || existing.startsWith(`${field}.`)) delete provenance[existing];
      result[key] = structuredClone(value);
      seedProvenance(value, source, provenance, field);
    }
    else {
      for (const existing of Object.keys(provenance)) if (existing === field || existing.startsWith(`${field}.`)) delete provenance[existing];
      result[key] = structuredClone(value);
      provenance[field] = source;
    }
  }
  return result;
}

function seedProvenance(value, source, provenance, prefix = "") {
  for (const [key, child] of Object.entries(value ?? {})) {
    const field = prefix ? `${prefix}.${key}` : key;
    if (isObject(child)) seedProvenance(child, source, provenance, field);
    else provenance[field] = source;
  }
}

function fieldAt(value, dottedPath) {
  return dottedPath.split(".").reduce((current, key) => current?.[key], value);
}

export function validateResolvedEvaluationPlan(plan, requiredFields) {
  for (const requirement of requiredFields) {
    const descriptor = typeof requirement === "string" ? { path: requirement } : requirement;
    const value = fieldAt(plan, descriptor.path);
    const validType = descriptor.type === "array" ? Array.isArray(value) : descriptor.type ? typeof value === descriptor.type : value !== undefined && value !== null;
    const validValue = validType && (descriptor.type !== "string" || value.trim().length > 0);
    if (!validValue) throw new EvaluationPlanError("evaluation_plan_required_field_invalid", { field: descriptor.path, expected_type: descriptor.type ?? "present" });
  }
  return plan;
}

export async function resolveEvaluationPlan({ root, planPath, requiredFields = [], readPlan = null }) {
  const resolvedRoot = path.resolve(root);
  const load = readPlan ?? (async (absolutePath) => {
    try { const bytes = await readFile(absolutePath); return { bytes, value: JSON.parse(bytes.toString("utf8")) }; }
    catch (error) {
      if (error?.code === "ENOENT") throw new EvaluationPlanError("evaluation_plan_parent_missing", { plan: path.relative(resolvedRoot, absolutePath).replaceAll("\\", "/") });
      if (error instanceof SyntaxError) throw new EvaluationPlanError("evaluation_plan_malformed", { plan: path.relative(resolvedRoot, absolutePath).replaceAll("\\", "/") });
      throw error;
    }
  });
  const visiting = new Set(); const chain = [];
  const visit = async (reference) => {
    const absolutePath = path.resolve(resolvedRoot, reference);
    if (absolutePath !== resolvedRoot && !absolutePath.startsWith(`${resolvedRoot}${path.sep}`)) throw new EvaluationPlanError("evaluation_plan_parent_outside_root");
    const canonical = absolutePath.toLowerCase();
    if (visiting.has(canonical)) throw new EvaluationPlanError("evaluation_plan_inheritance_cycle", { plan: reference });
    visiting.add(canonical); chain.push(reference);
    const loaded = await load(absolutePath); const plan = loaded.value;
    if (!isObject(plan)) throw new EvaluationPlanError("evaluation_plan_malformed", { plan: reference });
    const parentReference = inheritanceReference(plan);
    let resolved = {}; const provenance = {};
    if (parentReference !== null) {
      if (typeof parentReference !== "string" || !parentReference.trim()) throw new EvaluationPlanError("evaluation_plan_required_field_invalid", { field: plan.parent_plan !== undefined ? "parent_plan" : "base_plan", expected_type: "string" });
      const parent = await visit(parentReference);
      const expectedHash = inheritanceHash(plan);
      if (expectedHash !== null && expectedHash !== undefined) {
        if (typeof expectedHash !== "string" || !/^[a-f0-9]{64}$/i.test(expectedHash)) throw new EvaluationPlanError("evaluation_plan_parent_hash_invalid");
        if (createHash("sha256").update(parent.bytes).digest("hex") !== expectedHash.toLowerCase()) throw new EvaluationPlanError("evaluation_plan_parent_hash_mismatch");
      }
      resolved = structuredClone(parent.plan); Object.assign(provenance, parent.provenance);
    }
    if (!parentReference) seedProvenance(plan, reference, provenance);
    resolved = mergeResolved(resolved, plan, reference, provenance);
    visiting.delete(canonical);
    return { plan: resolved, provenance, bytes: loaded.bytes };
  };
  const entry = path.relative(resolvedRoot, path.resolve(planPath)).replaceAll("\\", "/");
  const result = await visit(entry);
  validateResolvedEvaluationPlan(result.plan, requiredFields);
  return { ...result, chain };
}
