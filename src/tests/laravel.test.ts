import { describe, test, expect } from "bun:test";
import { LaravelRecipe } from '../recipes/laravel';
import { UseContextSchema, ExecutionPlanSchema } from '../core/spec';

describe("Integration: Laravel Recipe", () => {
  const context = UseContextSchema.parse({
    runtime: 'laravel',
    dryRun: true,
  });

  test("declares depends on php-sqlite", () => {
    expect(LaravelRecipe.depends).toEqual(['php-sqlite']);
  });

  test("resolves plan with 1 install step", async () => {
    const plan = await LaravelRecipe.resolve(context);
    expect(plan.installSteps).toHaveLength(1);
    const step = plan.installSteps[0]!;
    expect(step.id).toBeDefined();
    expect(step.label).toBeDefined();
    expect(step.cmd).toBeDefined();
  });

  test("env is empty", async () => {
    const plan = await LaravelRecipe.resolve(context);
    expect(Object.keys(plan.env)).toHaveLength(0);
  });

  test("paths is empty", async () => {
    const plan = await LaravelRecipe.resolve(context);
    expect(plan.paths).toHaveLength(0);
  });

  test("all install steps have string commands", async () => {
    const plan = await LaravelRecipe.resolve(context);
    for (const step of plan.installSteps) {
      expect(typeof step.cmd).toBe('string');
    }
  });

  test("plan validates against ExecutionPlanSchema", async () => {
    const plan = await LaravelRecipe.resolve(context);
    const parsed = ExecutionPlanSchema.parse(plan);
    expect(parsed).toBeDefined();
    expect(parsed.installSteps.length).toBe(plan.installSteps.length);
  });

  test("every step has a checkCmd", async () => {
    const plan = await LaravelRecipe.resolve(context);
    for (const step of plan.installSteps) {
      expect(step.checkCmd).toBeDefined();
      expect(typeof step.checkCmd).toBe('string');
    }
  });

  test("does not set DART_SDK, FLUTTER_ROOT, GEM_HOME, or COMPOSER_HOME", async () => {
    const plan = await LaravelRecipe.resolve(context);
    expect(plan.env['DART_SDK']).toBeUndefined();
    expect(plan.env['FLUTTER_ROOT']).toBeUndefined();
    expect(plan.env['GEM_HOME']).toBeUndefined();
    expect(plan.env['COMPOSER_HOME']).toBeUndefined();
  });

  test("install step cmd contains composer global require laravel/installer", async () => {
    const plan = await LaravelRecipe.resolve(context);
    const step = plan.installSteps.find(s => s.id === 'install-laravel-installer');
    expect(step?.cmd).toContain('composer global require laravel/installer');
  });

  test("cmd does not contain manual shellenv sourcing", async () => {
    const plan = await LaravelRecipe.resolve(context);
    const step = plan.installSteps.find(s => s.id === 'install-laravel-installer');
    expect(step?.cmd).not.toContain('.jules/shellenv');
  });

  test("install step checkCmd contains laravel --version", async () => {
    const plan = await LaravelRecipe.resolve(context);
    const step = plan.installSteps.find(s => s.id === 'install-laravel-installer');
    expect(step?.checkCmd).toContain('laravel --version');
  });

  test("checkCmd does not contain manual shellenv sourcing", async () => {
    const plan = await LaravelRecipe.resolve(context);
    const step = plan.installSteps.find(s => s.id === 'install-laravel-installer');
    expect(step?.checkCmd).not.toContain('.jules/shellenv');
  });

  if (process.platform === 'darwin') {
    test("macOS: 1 step: install-laravel-installer", async () => {
      const plan = await LaravelRecipe.resolve(context);
      expect(plan.installSteps).toHaveLength(1);
      expect(plan.installSteps[0]!.id).toBe('install-laravel-installer');
    });
  }

  if (process.platform === 'linux') {
    test("linux: 1 step: install-laravel-installer", async () => {
      const plan = await LaravelRecipe.resolve(context);
      expect(plan.installSteps).toHaveLength(1);
      expect(plan.installSteps[0]!.id).toBe('install-laravel-installer');
    });
  }
});
