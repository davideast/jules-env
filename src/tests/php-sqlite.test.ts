import { describe, test, expect } from "bun:test";
import { PhpSqliteRecipe } from '../recipes/php-sqlite';
import { UseContextSchema, ExecutionPlanSchema } from '../core/spec';

describe("Integration: PHP SQLite Recipe", () => {
  const context = UseContextSchema.parse({
    runtime: 'php-sqlite',
    dryRun: true,
  });

  test("plan validates against ExecutionPlanSchema", async () => {
    const plan = await PhpSqliteRecipe.resolve(context);
    const parsed = ExecutionPlanSchema.parse(plan);
    expect(parsed).toBeDefined();
    expect(parsed.installSteps.length).toBe(plan.installSteps.length);
  });

  test("env is empty", async () => {
    const plan = await PhpSqliteRecipe.resolve(context);
    expect(Object.keys(plan.env)).toHaveLength(0);
  });

  test("paths is empty", async () => {
    const plan = await PhpSqliteRecipe.resolve(context);
    expect(plan.paths).toHaveLength(0);
  });

  test("does not set DART_SDK, FLUTTER_ROOT, GEM_HOME, or COMPOSER_HOME", async () => {
    const plan = await PhpSqliteRecipe.resolve(context);
    expect(plan.env['DART_SDK']).toBeUndefined();
    expect(plan.env['FLUTTER_ROOT']).toBeUndefined();
    expect(plan.env['GEM_HOME']).toBeUndefined();
    expect(plan.env['COMPOSER_HOME']).toBeUndefined();
  });

  if (process.platform === 'darwin') {
    test("macOS: 0 install steps (no-op)", async () => {
      const plan = await PhpSqliteRecipe.resolve(context);
      expect(plan.installSteps).toHaveLength(0);
    });
  }

  if (process.platform === 'linux') {
    test("linux: 1 step: install-php-sqlite", async () => {
      const plan = await PhpSqliteRecipe.resolve(context);
      expect(plan.installSteps).toHaveLength(1);
      expect(plan.installSteps[0]!.id).toBe('install-php-sqlite');
    });

    test("linux: step installs php-sqlite3 via apt-get", async () => {
      const plan = await PhpSqliteRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'install-php-sqlite');
      expect(step?.cmd).toContain('apt-get');
      expect(step?.cmd).toContain('php-sqlite3');
    });

    test("linux: checkCmd uses dpkg -s php-sqlite3", async () => {
      const plan = await PhpSqliteRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'install-php-sqlite');
      expect(step?.checkCmd).toBe('dpkg -s php-sqlite3');
    });
  }
});
