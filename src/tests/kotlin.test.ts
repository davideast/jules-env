import { describe, test, expect } from "bun:test";
import { KotlinRecipe } from '../recipes/kotlin';
import { UseContextSchema, ExecutionPlanSchema } from '../core/spec';

describe("Integration: Kotlin Recipe", () => {
  const context = UseContextSchema.parse({
    runtime: 'kotlin',
    dryRun: true,
  });

  test("resolves plan on current platform", async () => {
    const plan = await KotlinRecipe.resolve(context);
    expect(plan.installSteps.length).toBeGreaterThan(0);
    for (const step of plan.installSteps) {
      expect(step.id).toBeDefined();
      expect(step.label).toBeDefined();
      expect(step.cmd).toBeDefined();
    }
  });

  test("sets KOTLIN_HOME env var", async () => {
    const plan = await KotlinRecipe.resolve(context);
    expect(plan.env['KOTLIN_HOME']).toBeDefined();
    expect(plan.env['KOTLIN_HOME']!.length).toBeGreaterThan(0);
  });

  test("paths include bin", async () => {
    const plan = await KotlinRecipe.resolve(context);
    expect(plan.paths.some(p => p.includes('/bin'))).toBe(true);
  });

  test("all install steps have string commands", async () => {
    const plan = await KotlinRecipe.resolve(context);
    for (const step of plan.installSteps) {
      expect(typeof step.cmd).toBe('string');
    }
  });

  test("plan validates against ExecutionPlanSchema", async () => {
    const plan = await KotlinRecipe.resolve(context);
    const parsed = ExecutionPlanSchema.parse(plan);
    expect(parsed).toBeDefined();
    expect(parsed.installSteps.length).toBe(plan.installSteps.length);
  });

  test("every step has a checkCmd", async () => {
    const plan = await KotlinRecipe.resolve(context);
    for (const step of plan.installSteps) {
      expect(step.checkCmd).toBeDefined();
      expect(typeof step.checkCmd).toBe('string');
    }
  });

  if (process.platform === 'darwin') {
    test("macOS: single install step uses brew install kotlin", async () => {
      const plan = await KotlinRecipe.resolve(context);
      const installStep = plan.installSteps.find(s => s.id === 'install-kotlin');
      expect(installStep).toBeDefined();
      expect(installStep?.cmd).toBe('brew install kotlin');
      expect(installStep?.checkCmd).toBe('brew list --versions kotlin');
    });

    test("macOS: KOTLIN_HOME is set based on prefix", async () => {
      const plan = await KotlinRecipe.resolve(context);
      expect(plan.env['KOTLIN_HOME']).toMatch(/\/libexec$/);
    });

    test("macOS: paths has 1 entry: kotlin prefix bin", async () => {
      const plan = await KotlinRecipe.resolve(context);
      expect(plan.paths.length).toBe(1);
      expect(plan.paths[0]).toMatch(/\/bin$/);
    });
  }

  if (process.platform === 'linux') {
    test("linux: has 2 steps: install-kotlin-prereqs and install-kotlin-compiler", async () => {
      const plan = await KotlinRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(2);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toContain('install-kotlin-prereqs');
      expect(stepIds).toContain('install-kotlin-compiler');
    });

    test("linux: prerequisites step installs unzip and zip", async () => {
      const plan = await KotlinRecipe.resolve(context);
      const prereqs = plan.installSteps.find(s => s.id === 'install-kotlin-prereqs');
      expect(prereqs?.cmd).toContain('apt-get');
      expect(prereqs?.cmd).toContain('unzip');
      expect(prereqs?.cmd).toContain('zip');
    });

    test("linux: install step uses curl and unzip", async () => {
      const plan = await KotlinRecipe.resolve(context);
      const installStep = plan.installSteps.find(s => s.id === 'install-kotlin-compiler');
      expect(installStep?.cmd).toContain('curl');
      expect(installStep?.cmd).toContain('unzip');
      expect(installStep?.cmd).toContain('v2.1.0');
    });

    test("linux: KOTLIN_HOME is /usr/local/kotlinc", async () => {
      const plan = await KotlinRecipe.resolve(context);
      expect(plan.env['KOTLIN_HOME']).toBe('/usr/local/kotlinc');
    });

    test("linux: paths is ['/usr/local/kotlinc/bin']", async () => {
      const plan = await KotlinRecipe.resolve(context);
      expect(plan.paths).toEqual(['/usr/local/kotlinc/bin']);
    });
  }
});
