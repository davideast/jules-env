import { describe, test, expect } from "bun:test";
import { MysqlRecipe } from '../recipes/mysql';
import { UseContextSchema, ExecutionPlanSchema } from '../core/spec';

describe("Integration: MySQL Recipe", () => {
  const context = UseContextSchema.parse({
    runtime: 'mysql',
    dryRun: true,
  });

  const contextWithPreset = UseContextSchema.parse({
    runtime: 'mysql',
    dryRun: true,
    preset: 'testdb',
  });

  test("resolves plan on current platform", async () => {
    const plan = await MysqlRecipe.resolve(context);
    expect(plan.installSteps.length).toBeGreaterThan(0);
    for (const step of plan.installSteps) {
      expect(step.id).toBeDefined();
      expect(step.label).toBeDefined();
      expect(step.cmd).toBeDefined();
    }
  });

  if (process.platform === 'darwin') {
    test("macOS: sets MYSQL_HOST env var to 127.0.0.1", async () => {
      const plan = await MysqlRecipe.resolve(context);
      expect(plan.env['MYSQL_HOST']).toBe('127.0.0.1');
    });
  }

  if (process.platform === 'linux') {
    test("linux: sets MYSQL_HOST env var to localhost (implies socket)", async () => {
      const plan = await MysqlRecipe.resolve(context);
      expect(plan.env['MYSQL_HOST']).toBe('localhost');
    });
  }

  test("paths is empty", async () => {
    const plan = await MysqlRecipe.resolve(context);
    expect(plan.paths).toEqual([]);
  });

  test("plan validates against ExecutionPlanSchema", async () => {
    const plan = await MysqlRecipe.resolve(context);
    const parsed = ExecutionPlanSchema.parse(plan);
    expect(parsed).toBeDefined();
  });

  test("wait-for-mariadb has no checkCmd", async () => {
    const plan = await MysqlRecipe.resolve(context);
    const waitStep = plan.installSteps.find(s => s.id === 'wait-for-mariadb');
    expect(waitStep).toBeDefined();
    expect(waitStep?.checkCmd).toBeUndefined();
  });

  test("all steps except wait-for-mariadb have a checkCmd", async () => {
    const plan = await MysqlRecipe.resolve(context);
    for (const step of plan.installSteps) {
      if (step.id === 'wait-for-mariadb') continue;
      expect(step.checkCmd).toBeDefined();
      expect(typeof step.checkCmd).toBe('string');
    }
  });

  test("does not set DART_SDK, FLUTTER_ROOT, GEM_HOME, COMPOSER_HOME", async () => {
    const plan = await MysqlRecipe.resolve(context);
    expect(plan.env['DART_SDK']).toBeUndefined();
    expect(plan.env['FLUTTER_ROOT']).toBeUndefined();
    expect(plan.env['GEM_HOME']).toBeUndefined();
    expect(plan.env['COMPOSER_HOME']).toBeUndefined();
  });

  test("without preset -> no create-database step", async () => {
    const plan = await MysqlRecipe.resolve(context);
    const createStep = plan.installSteps.find(s => s.id === 'create-database');
    expect(createStep).toBeUndefined();
  });

  test("with preset -> has create-database step", async () => {
    const plan = await MysqlRecipe.resolve(contextWithPreset);
    const createStep = plan.installSteps.find(s => s.id === 'create-database');
    expect(createStep).toBeDefined();
    expect(createStep?.label).toContain('testdb');
    expect(createStep?.cmd).toContain('testdb');
    expect(createStep?.checkCmd).toBeDefined();
    expect(createStep?.checkCmd).toContain('testdb');
  });

  if (process.platform === 'darwin') {
    test("macOS: 3 steps without preset", async () => {
      const plan = await MysqlRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(3);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toEqual(['install-mariadb', 'start-mariadb', 'wait-for-mariadb']);
    });

    test("macOS: 4 steps with preset", async () => {
      const plan = await MysqlRecipe.resolve(contextWithPreset);
      expect(plan.installSteps.length).toBe(4);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toEqual(['install-mariadb', 'start-mariadb', 'wait-for-mariadb', 'create-database']);
    });

    test("macOS: install uses brew", async () => {
      const plan = await MysqlRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'install-mariadb');
      expect(step?.cmd).toBe('brew install mariadb');
      expect(step?.checkCmd).toBe('brew list --versions mariadb');
    });

    test("macOS: start uses brew services", async () => {
      const plan = await MysqlRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'start-mariadb');
      expect(step?.cmd).toBe('brew services start mariadb');
    });

    test("macOS: no setup-user step", async () => {
      const plan = await MysqlRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'setup-user');
      expect(step).toBeUndefined();
    });
  }

  if (process.platform === 'linux') {
    test("linux: 4 steps without preset", async () => {
      const plan = await MysqlRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(4);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toEqual(['install-mariadb', 'start-mariadb', 'wait-for-mariadb', 'setup-user']);
    });

    test("linux: 5 steps with preset", async () => {
      const plan = await MysqlRecipe.resolve(contextWithPreset);
      expect(plan.installSteps.length).toBe(5);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toEqual(['install-mariadb', 'start-mariadb', 'wait-for-mariadb', 'setup-user', 'create-database']);
    });

    test("linux: install uses apt-get", async () => {
      const plan = await MysqlRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'install-mariadb');
      expect(step?.cmd).toContain('apt-get install -y mariadb-server');
    });

    test("linux: start cmd contains systemctl and mysqld_safe", async () => {
      const plan = await MysqlRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'start-mariadb');
      expect(step?.cmd).toContain('systemctl');
      expect(step?.cmd).toContain('mysqld_safe');
      expect(step?.cmd).toContain('/run/mysqld');
    });

    test("linux: setup-user step exists and contains unix_socket", async () => {
      const plan = await MysqlRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'setup-user');
      expect(step).toBeDefined();
      expect(step?.cmd).toContain('unix_socket');
      expect(step?.cmd).toContain('CREATE USER');
    });
  }
});
