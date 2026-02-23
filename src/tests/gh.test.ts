import { describe, test, expect } from "bun:test";
import { GhRecipe } from '../recipes/gh';
import { UseContextSchema, ExecutionPlanSchema } from '../core/spec';

describe("Integration: Gh Recipe", () => {
  const context = UseContextSchema.parse({
    runtime: 'gh',
    dryRun: true,
  });

  test("resolves plan on current platform", async () => {
    const plan = await GhRecipe.resolve(context);
    expect(plan.installSteps.length).toBeGreaterThan(0);
    for (const step of plan.installSteps) {
      expect(step.id).toBeDefined();
      expect(step.label).toBeDefined();
      expect(step.cmd).toBeDefined();
    }
  });

  test("env is empty", async () => {
    const plan = await GhRecipe.resolve(context);
    expect(Object.keys(plan.env).length).toBe(0);
  });

  test("all install steps have string commands", async () => {
    const plan = await GhRecipe.resolve(context);
    for (const step of plan.installSteps) {
      expect(typeof step.cmd).toBe('string');
    }
  });

  test("plan validates against ExecutionPlanSchema", async () => {
    const plan = await GhRecipe.resolve(context);
    const parsed = ExecutionPlanSchema.parse(plan);
    expect(parsed).toBeDefined();
    expect(parsed.installSteps.length).toBe(plan.installSteps.length);
  });

  test("every step has a checkCmd", async () => {
    const plan = await GhRecipe.resolve(context);
    for (const step of plan.installSteps) {
      expect(step.checkCmd).toBeDefined();
      expect(typeof step.checkCmd).toBe('string');
    }
  });

  if (process.platform === 'darwin') {
    test("macOS: single install step uses brew install gh", async () => {
      const plan = await GhRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(1);
      const installStep = plan.installSteps.find(s => s.id === 'install-gh');
      expect(installStep).toBeDefined();
      expect(installStep?.cmd).toBe('brew install gh');
      expect(installStep?.checkCmd).toBe('brew list --versions gh');
    });

    test("macOS: paths has 1 entry", async () => {
      const plan = await GhRecipe.resolve(context);
      expect(plan.paths.length).toBe(1);
      expect(plan.paths[0]).toMatch(/\/bin$/);
    });
  }

  if (process.platform === 'linux') {
    test("linux: has 4 steps", async () => {
      const plan = await GhRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(4);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toContain('install-gh-prereqs');
      expect(stepIds).toContain('add-gh-signing-key');
      expect(stepIds).toContain('add-gh-repo');
      expect(stepIds).toContain('install-gh');
    });

    test("linux: prerequisites step installs apt-transport-https and wget", async () => {
      const plan = await GhRecipe.resolve(context);
      const prereqs = plan.installSteps.find(s => s.id === 'install-gh-prereqs');
      expect(prereqs?.cmd).toContain('apt-transport-https');
      expect(prereqs?.cmd).toContain('wget');
    });

    test("linux: install step uses gh", async () => {
      const plan = await GhRecipe.resolve(context);
      const installStep = plan.installSteps.find(s => s.id === 'install-gh');
      expect(installStep?.cmd).toContain('install -y gh');
    });

    test("linux: paths is empty", async () => {
      const plan = await GhRecipe.resolve(context);
      expect(plan.paths.length).toBe(0);
    });
  }
});
