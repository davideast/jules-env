import { describe, test, expect } from "bun:test";
import { MongoRecipe } from '../recipes/mongo';
import { UseContextSchema, ExecutionPlanSchema } from '../core/spec';

describe("Integration: Mongo Recipe", () => {
  const context = UseContextSchema.parse({
    runtime: 'mongo',
    dryRun: true,
  });

  const contextWithPreset = UseContextSchema.parse({
    runtime: 'mongo',
    dryRun: true,
    preset: 'testdb',
  });

  test("resolves plan on current platform", async () => {
    const plan = await MongoRecipe.resolve(context);
    expect(plan.installSteps.length).toBeGreaterThan(0);
    for (const step of plan.installSteps) {
      expect(step.id).toBeDefined();
      expect(step.label).toBeDefined();
      expect(step.cmd).toBeDefined();
    }
  });

  test("sets MONGO_URL env var", async () => {
    const plan = await MongoRecipe.resolve(context);
    expect(plan.env['MONGO_URL']).toBe('mongodb://localhost:27017');
  });

  test("paths is empty", async () => {
    const plan = await MongoRecipe.resolve(context);
    expect(plan.paths).toEqual([]);
  });

  test("plan validates against ExecutionPlanSchema", async () => {
    const plan = await MongoRecipe.resolve(context);
    const parsed = ExecutionPlanSchema.parse(plan);
    expect(parsed).toBeDefined();
  });

  test("wait-for-mongo has no checkCmd", async () => {
    const plan = await MongoRecipe.resolve(context);
    const waitStep = plan.installSteps.find(s => s.id === 'wait-for-mongo');
    expect(waitStep).toBeDefined();
    expect(waitStep?.checkCmd).toBeUndefined();
  });

  test("all steps except wait-for-mongo have a checkCmd", async () => {
    const plan = await MongoRecipe.resolve(context);
    for (const step of plan.installSteps) {
      if (step.id === 'wait-for-mongo') continue;
      expect(step.checkCmd).toBeDefined();
      expect(typeof step.checkCmd).toBe('string');
    }
  });

  test("without preset -> no create-database step", async () => {
    const plan = await MongoRecipe.resolve(context);
    const createStep = plan.installSteps.find(s => s.id === 'create-database');
    expect(createStep).toBeUndefined();
  });

  test("with preset -> has create-database step", async () => {
    const plan = await MongoRecipe.resolve(contextWithPreset);
    const createStep = plan.installSteps.find(s => s.id === 'create-database');
    expect(createStep).toBeDefined();
    expect(createStep?.label).toContain('testdb');
    expect(createStep?.cmd).toContain('testdb');
    expect(createStep?.checkCmd).toBeDefined();
    expect(createStep?.checkCmd).toContain('testdb');
  });

  if (process.platform === 'darwin') {
    test("macOS: 3 steps without preset", async () => {
      const plan = await MongoRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(3);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toEqual(['install-mongo', 'start-mongo', 'wait-for-mongo']);
    });

    test("macOS: 4 steps with preset", async () => {
      const plan = await MongoRecipe.resolve(contextWithPreset);
      expect(plan.installSteps.length).toBe(4);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toEqual(['install-mongo', 'start-mongo', 'wait-for-mongo', 'create-database']);
    });

    test("macOS: install uses brew tap and install", async () => {
      const plan = await MongoRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'install-mongo');
      expect(step?.cmd).toContain('brew tap mongodb/brew');
      expect(step?.cmd).toContain('brew install mongodb-community');
      expect(step?.checkCmd).toBe('brew list --versions mongodb-community');
    });

    test("macOS: start uses brew services", async () => {
      const plan = await MongoRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'start-mongo');
      expect(step?.cmd).toBe('brew services start mongodb-community');
    });
  }

  if (process.platform === 'linux') {
    test("linux: 6 steps without preset", async () => {
      const plan = await MongoRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(6);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toEqual(['install-prereqs', 'add-key', 'add-repo', 'install-mongo', 'start-mongo', 'wait-for-mongo']);
    });

    test("linux: 7 steps with preset", async () => {
      const plan = await MongoRecipe.resolve(contextWithPreset);
      expect(plan.installSteps.length).toBe(7);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toEqual(['install-prereqs', 'add-key', 'add-repo', 'install-mongo', 'start-mongo', 'wait-for-mongo', 'create-database']);
    });

    test("linux: install uses apt-get", async () => {
      const plan = await MongoRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'install-mongo');
      expect(step?.cmd).toContain('apt-get install -y mongodb-org');
    });

    test("linux: add-key uses curl and gpg", async () => {
      const plan = await MongoRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'add-key');
      expect(step?.cmd).toContain('curl');
      expect(step?.cmd).toContain('gpg');
      expect(step?.cmd).toContain('/usr/share/keyrings/mongodb-server-8.0.gpg');
    });

    test("linux: add-repo adds noble source", async () => {
      const plan = await MongoRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'add-repo');
      expect(step?.cmd).toContain('ubuntu noble/mongodb-org/8.0 multiverse');
      expect(step?.cmd).toContain('/etc/apt/sources.list.d/mongodb-org-8.0.list');
    });

    test("linux: start cmd contains systemctl and mongod fork", async () => {
      const plan = await MongoRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'start-mongo');
      expect(step?.cmd).toContain('systemctl');
      expect(step?.cmd).toContain('mongod');
      expect(step?.cmd).toContain('--fork');
    });
  }
});
