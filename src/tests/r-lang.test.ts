import { describe, test, expect } from "bun:test";
import { RRecipe } from '../recipes/r-lang';
import { UseContextSchema, ExecutionPlanSchema } from '../core/spec';

describe("Integration: R Recipe", () => {
  const context = UseContextSchema.parse({
    runtime: 'r-lang',
    dryRun: true,
  });

  test("resolves plan on current platform", async () => {
    const plan = await RRecipe.resolve(context);
    expect(plan.installSteps.length).toBeGreaterThan(0);
    for (const step of plan.installSteps) {
      expect(step.id).toBeDefined();
      expect(step.label).toBeDefined();
      expect(step.cmd).toBeDefined();
    }
  });

  test("sets R_LIBS_USER env var", async () => {
    const plan = await RRecipe.resolve(context);
    expect(plan.env['R_LIBS_USER']).toBeDefined();
    expect(plan.env['R_LIBS_USER']!.length).toBeGreaterThan(0);
    expect(plan.env['R_LIBS_USER']).toBe('$HOME/.local/lib/R');
  });

  test("all install steps have string commands", async () => {
    const plan = await RRecipe.resolve(context);
    for (const step of plan.installSteps) {
      expect(typeof step.cmd).toBe('string');
    }
  });

  test("plan validates against ExecutionPlanSchema", async () => {
    const plan = await RRecipe.resolve(context);
    const parsed = ExecutionPlanSchema.parse(plan);
    expect(parsed).toBeDefined();
    expect(parsed.installSteps.length).toBe(plan.installSteps.length);
  });

  test("every step has a checkCmd", async () => {
    const plan = await RRecipe.resolve(context);
    for (const step of plan.installSteps) {
      expect(step.checkCmd).toBeDefined();
      expect(typeof step.checkCmd).toBe('string');
    }
  });

  if (process.platform === 'darwin') {
    test("macOS: single install step uses brew install r", async () => {
      const plan = await RRecipe.resolve(context);
      const installStep = plan.installSteps.find(s => s.id === 'install-r');
      expect(installStep).toBeDefined();
      expect(installStep?.cmd).toBe('brew install r');
      expect(installStep?.checkCmd).toBe('brew list --versions r');
    });

    test("macOS: paths has 1 entry: r prefix bin", async () => {
      const plan = await RRecipe.resolve(context);
      expect(plan.paths.length).toBe(1);
      expect(plan.paths[0]).toMatch(/\/bin$/);
    });
  }

  if (process.platform === 'linux') {
    test("linux: single install step uses r-base via apt-get", async () => {
      const plan = await RRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(1);
      const installStep = plan.installSteps.find(s => s.id === 'install-r-base');
      expect(installStep).toBeDefined();
      expect(installStep?.cmd).toContain('apt-get');
      expect(installStep?.cmd).toContain('r-base');
      expect(installStep?.checkCmd).toBe('dpkg -s r-base');
    });

    test("linux: paths is empty", async () => {
      const plan = await RRecipe.resolve(context);
      expect(plan.paths).toEqual([]);
    });
  }
});
