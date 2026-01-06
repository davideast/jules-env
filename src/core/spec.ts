import { z } from 'zod';

// 1. THE INPUT (User Intent)
export const UseContextSchema = z.object({
  runtime: z.string(),
  version: z.string().default('latest'),
  preset: z.string().optional(),
  options: z.record(z.union([z.string(), z.boolean()])).default({}),
  dryRun: z.boolean().default(false),
});

export type UseContext = z.infer<typeof UseContextSchema>;

// 2. THE OUTPUT (The Plan)
const ShellStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  cmd: z.string(),
  checkCmd: z.string().optional().describe("If this cmd exits 0, skip the main cmd"),
});

export const ExecutionPlanSchema = z.object({
  installSteps: z.array(ShellStepSchema),
  env: z.record(z.string()).describe("Env vars to persist (e.g. DART_SDK)"),
  paths: z.array(z.string()).describe("Paths to prepend to PATH"),
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
  })).default([]),
});

export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

// 3. THE BEHAVIOR (The Interface)
export interface Recipe {
  name: string;
  description: string;
  /**
   * Logic engine. Must be Read-Only.
   * Can probe system (e.g. `brew --prefix`) but MUST NOT install software.
   * Returns a Plan.
   */
  resolve: (ctx: UseContext) => Promise<ExecutionPlan>;
}
