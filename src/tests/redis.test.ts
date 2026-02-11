import { describe, test, expect } from "bun:test";
import { RedisRecipe } from '../recipes/redis';
import { UseContextSchema, ExecutionPlanSchema } from '../core/spec';

describe("Integration: Redis Recipe", () => {
  const context = UseContextSchema.parse({
    runtime: 'redis',
    dryRun: true,
  });

  test("resolves plan on current platform", async () => {
    const plan = await RedisRecipe.resolve(context);
    expect(plan.installSteps.length).toBeGreaterThan(0);
    for (const step of plan.installSteps) {
      expect(step.id).toBeDefined();
      expect(step.label).toBeDefined();
      expect(step.cmd).toBeDefined();
    }
  });

  test("sets REDIS_URL env var", async () => {
    const plan = await RedisRecipe.resolve(context);
    expect(plan.env['REDIS_URL']).toBe('redis://localhost:6379');
  });

  test("paths is empty", async () => {
    const plan = await RedisRecipe.resolve(context);
    expect(plan.paths).toEqual([]);
  });

  test("plan validates against ExecutionPlanSchema", async () => {
    const plan = await RedisRecipe.resolve(context);
    const parsed = ExecutionPlanSchema.parse(plan);
    expect(parsed).toBeDefined();
  });

  test("wait-for-redis has no checkCmd", async () => {
    const plan = await RedisRecipe.resolve(context);
    const waitStep = plan.installSteps.find(s => s.id === 'wait-for-redis');
    expect(waitStep).toBeDefined();
    expect(waitStep?.checkCmd).toBeUndefined();
  });

  test("all steps except wait-for-redis have a checkCmd", async () => {
    const plan = await RedisRecipe.resolve(context);
    for (const step of plan.installSteps) {
      if (step.id === 'wait-for-redis') continue;
      expect(step.checkCmd).toBeDefined();
      expect(typeof step.checkCmd).toBe('string');
    }
  });

  if (process.platform === 'darwin') {
    test("macOS: 3 steps", async () => {
      const plan = await RedisRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(3);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toEqual(['install-redis', 'start-redis', 'wait-for-redis']);
    });

    test("macOS: install uses brew", async () => {
      const plan = await RedisRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'install-redis');
      expect(step?.cmd).toBe('brew install redis');
      expect(step?.checkCmd).toBe('brew list --versions redis');
    });

    test("macOS: start uses brew services", async () => {
      const plan = await RedisRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'start-redis');
      expect(step?.cmd).toBe('brew services start redis');
    });
  }

  if (process.platform === 'linux') {
    test("linux: 3 steps", async () => {
      const plan = await RedisRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(3);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toEqual(['install-redis', 'start-redis', 'wait-for-redis']);
    });

    test("linux: install uses apt-get", async () => {
      const plan = await RedisRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'install-redis');
      expect(step?.cmd).toContain('apt-get install -y redis-server');
    });

    test("linux: start cmd contains systemctl and redis-server --daemonize", async () => {
      const plan = await RedisRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'start-redis');
      expect(step?.cmd).toContain('systemctl');
      expect(step?.cmd).toContain('redis-server --daemonize');
    });
  }
});
