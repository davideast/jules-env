import { describe, test, expect } from "bun:test";
import { DenoRecipe } from '../recipes/deno';
import { UseContextSchema, ExecutionPlanSchema } from '../core/spec';

describe("Integration: Deno Recipe", () => {
  const context = UseContextSchema.parse({
    runtime: 'deno',
    dryRun: true,
  });

  test("resolves plan on current platform", async () => {
    const plan = await DenoRecipe.resolve(context);
    expect(plan.installSteps.length).toBeGreaterThan(0);
    for (const step of plan.installSteps) {
      expect(step.id).toBeDefined();
      expect(step.label).toBeDefined();
      expect(step.cmd).toBeDefined();
    }
  });

  test("sets DENO_DIR env var", async () => {
    const plan = await DenoRecipe.resolve(context);
    expect(plan.env['DENO_DIR']).toBeDefined();
    expect(plan.env['DENO_DIR']).toBe('$HOME/.deno');
  });

  test("paths include .deno/bin or brew path", async () => {
    const plan = await DenoRecipe.resolve(context);
    const hasDenoPath = plan.paths.some(p => p.includes('.deno/bin') || p.includes('/bin'));
    expect(hasDenoPath).toBe(true);
  });

  test("all install steps have string commands", async () => {
    const plan = await DenoRecipe.resolve(context);
    for (const step of plan.installSteps) {
      expect(typeof step.cmd).toBe('string');
    }
  });

  test("plan validates against ExecutionPlanSchema", async () => {
    const plan = await DenoRecipe.resolve(context);
    const parsed = ExecutionPlanSchema.parse(plan);
    expect(parsed).toBeDefined();
    expect(parsed.installSteps.length).toBe(plan.installSteps.length);
  });

  test("every step has a checkCmd", async () => {
    const plan = await DenoRecipe.resolve(context);
    for (const step of plan.installSteps) {
      expect(step.checkCmd).toBeDefined();
      expect(typeof step.checkCmd).toBe('string');
    }
  });

  if (process.platform === 'darwin') {
    test("macOS: install step uses brew install deno", async () => {
      const plan = await DenoRecipe.resolve(context);
      const installStep = plan.installSteps.find(s => s.id === 'install-deno');
      expect(installStep).toBeDefined();
      expect(installStep?.cmd).toBe('brew install deno');
      expect(installStep?.checkCmd).toBe('brew list --versions deno');
    });

    test("macOS: paths has 1 entry: deno prefix bin", async () => {
      const plan = await DenoRecipe.resolve(context);
      expect(plan.paths.length).toBe(1);
      expect(plan.paths[0]).toMatch(/\/bin$/);
    });
  }

  if (process.platform === 'linux') {
    test("linux: install step uses curl install script", async () => {
      const plan = await DenoRecipe.resolve(context);
      const installStep = plan.installSteps.find(s => s.id === 'install-deno');
      expect(installStep).toBeDefined();
      expect(installStep?.cmd).toContain('curl -fsSL https://deno.land/install.sh');
      expect(installStep?.checkCmd).toBe('test -f $HOME/.deno/bin/deno');
    });

    test("linux: paths is ['$HOME/.deno/bin']", async () => {
      const plan = await DenoRecipe.resolve(context);
      expect(plan.paths).toEqual(['$HOME/.deno/bin']);
    });
  }
});
