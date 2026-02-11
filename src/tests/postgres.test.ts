import { describe, test, expect } from "bun:test";
import { PostgresRecipe } from '../recipes/postgres';
import { UseContextSchema, ExecutionPlanSchema } from '../core/spec';

describe("Integration: Postgres Recipe", () => {
  const context = UseContextSchema.parse({
    runtime: 'postgres',
    dryRun: true,
  });

  const contextWithPreset = UseContextSchema.parse({
    runtime: 'postgres',
    dryRun: true,
    preset: 'testdb',
  });

  test("resolves plan on current platform", async () => {
    const plan = await PostgresRecipe.resolve(context);
    expect(plan.installSteps.length).toBeGreaterThan(0);
    for (const step of plan.installSteps) {
      expect(step.id).toBeDefined();
      expect(step.label).toBeDefined();
      expect(step.cmd).toBeDefined();
    }
  });

  test("sets PGHOST env var to localhost", async () => {
    const plan = await PostgresRecipe.resolve(context);
    expect(plan.env['PGHOST']).toBe('localhost');
  });

  test("plan validates against ExecutionPlanSchema", async () => {
    const plan = await PostgresRecipe.resolve(context);
    const parsed = ExecutionPlanSchema.parse(plan);
    expect(parsed).toBeDefined();
  });

  test("wait-for-postgres has no checkCmd", async () => {
    const plan = await PostgresRecipe.resolve(context);
    const waitStep = plan.installSteps.find(s => s.id === 'wait-for-postgres');
    expect(waitStep).toBeDefined();
    expect(waitStep?.checkCmd).toBeUndefined();
  });

  test("without preset -> no create-database step", async () => {
    const plan = await PostgresRecipe.resolve(context);
    const createStep = plan.installSteps.find(s => s.id === 'create-database');
    expect(createStep).toBeUndefined();
  });

  test("with preset -> has create-database step", async () => {
    const plan = await PostgresRecipe.resolve(contextWithPreset);
    const createStep = plan.installSteps.find(s => s.id === 'create-database');
    expect(createStep).toBeDefined();
    expect(createStep?.label).toContain('testdb');
    expect(createStep?.cmd).toContain('createdb testdb');
    expect(createStep?.checkCmd).toBeDefined();
    expect(createStep?.checkCmd).toContain('testdb');
  });

  if (process.platform === 'darwin') {
    test("macOS: 3 steps without preset", async () => {
      const plan = await PostgresRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(3);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toEqual(['install-postgres', 'start-postgres', 'wait-for-postgres']);
    });

    test("macOS: 4 steps with preset", async () => {
      const plan = await PostgresRecipe.resolve(contextWithPreset);
      expect(plan.installSteps.length).toBe(4);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toEqual(['install-postgres', 'start-postgres', 'wait-for-postgres', 'create-database']);
    });

    test("macOS: install uses brew", async () => {
      const plan = await PostgresRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'install-postgres');
      expect(step?.cmd).toBe('brew install postgresql@16');
      expect(step?.checkCmd).toBe('brew list --versions postgresql@16');
    });

    test("macOS: start uses brew services", async () => {
      const plan = await PostgresRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'start-postgres');
      expect(step?.cmd).toBe('brew services start postgresql@16');
    });

    test("macOS: sets paths", async () => {
      const plan = await PostgresRecipe.resolve(context);
      expect(plan.paths.length).toBeGreaterThan(0);
      expect(plan.paths[0]).toContain('/bin');
    });
  }

  if (process.platform === 'linux') {
    test("linux: 4 steps without preset", async () => {
      const plan = await PostgresRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(4);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toEqual(['install-postgres', 'start-postgres', 'wait-for-postgres', 'setup-user']);
    });

    test("linux: 5 steps with preset", async () => {
      const plan = await PostgresRecipe.resolve(contextWithPreset);
      expect(plan.installSteps.length).toBe(5);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toEqual(['install-postgres', 'start-postgres', 'wait-for-postgres', 'setup-user', 'create-database']);
    });

    test("linux: install uses apt-get", async () => {
      const plan = await PostgresRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'install-postgres');
      expect(step?.cmd).toContain('apt-get install -y postgresql postgresql-client');
    });

    test("linux: start cmd contains systemctl and pg_ctlcluster", async () => {
      const plan = await PostgresRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'start-postgres');
      expect(step?.cmd).toContain('systemctl');
      expect(step?.cmd).toContain('pg_ctlcluster');
    });

    test("linux: setup-user step exists", async () => {
      const plan = await PostgresRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'setup-user');
      expect(step).toBeDefined();
      expect(step?.cmd).toContain('createuser');
    });

     test("linux: paths is empty", async () => {
      const plan = await PostgresRecipe.resolve(context);
      expect(plan.paths).toEqual([]);
    });
  }
});
