import { describe, test, expect } from "bun:test";
import { PhpRecipe } from '../recipes/php';
import { UseContextSchema, ExecutionPlanSchema } from '../core/spec';

describe("Integration: PHP Recipe", () => {
  const context = UseContextSchema.parse({
    runtime: 'php',
    dryRun: true,
  });

  test("resolves plan on current platform", async () => {
    const plan = await PhpRecipe.resolve(context);
    expect(plan.installSteps.length).toBeGreaterThan(0);
    for (const step of plan.installSteps) {
      expect(step.id).toBeDefined();
      expect(step.label).toBeDefined();
      expect(step.cmd).toBeDefined();
    }
  });

  test("sets COMPOSER_HOME env var", async () => {
    const plan = await PhpRecipe.resolve(context);
    expect(plan.env['COMPOSER_HOME']).toBeDefined();
    expect(plan.env['COMPOSER_HOME']!.length).toBeGreaterThan(0);
  });

  test("paths include .config/composer/vendor/bin", async () => {
    const plan = await PhpRecipe.resolve(context);
    expect(plan.paths.some(p => p.includes('.config/composer/vendor/bin'))).toBe(true);
  });

  test("all install steps have string commands", async () => {
    const plan = await PhpRecipe.resolve(context);
    for (const step of plan.installSteps) {
      expect(typeof step.cmd).toBe('string');
    }
  });

  test("plan validates against ExecutionPlanSchema", async () => {
    const plan = await PhpRecipe.resolve(context);
    const parsed = ExecutionPlanSchema.parse(plan);
    expect(parsed).toBeDefined();
    expect(parsed.installSteps.length).toBe(plan.installSteps.length);
  });

  test("every step has a checkCmd", async () => {
    const plan = await PhpRecipe.resolve(context);
    for (const step of plan.installSteps) {
      expect(step.checkCmd).toBeDefined();
      expect(typeof step.checkCmd).toBe('string');
    }
  });

  test("does not set DART_SDK, FLUTTER_ROOT, or GEM_HOME", async () => {
    const plan = await PhpRecipe.resolve(context);
    expect(plan.env['DART_SDK']).toBeUndefined();
    expect(plan.env['FLUTTER_ROOT']).toBeUndefined();
    expect(plan.env['GEM_HOME']).toBeUndefined();
  });

  if (process.platform === 'darwin') {
    test("macOS: 2 install steps: install-php and install-composer", async () => {
      const plan = await PhpRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(2);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toContain('install-php');
      expect(stepIds).toContain('install-composer');
    });

    test("macOS: PHP step uses brew install php", async () => {
      const plan = await PhpRecipe.resolve(context);
      const phpStep = plan.installSteps.find(s => s.id === 'install-php');
      expect(phpStep).toBeDefined();
      expect(phpStep?.cmd).toBe('brew install php');
      expect(phpStep?.checkCmd).toBe('brew list --versions php');
    });

    test("macOS: Composer step uses brew install composer", async () => {
      const plan = await PhpRecipe.resolve(context);
      const composerStep = plan.installSteps.find(s => s.id === 'install-composer');
      expect(composerStep).toBeDefined();
      expect(composerStep?.cmd).toBe('brew install composer');
      expect(composerStep?.checkCmd).toBe('brew list --versions composer');
    });

    test("macOS: COMPOSER_HOME is $HOME/.config/composer", async () => {
      const plan = await PhpRecipe.resolve(context);
      expect(plan.env['COMPOSER_HOME']).toBe('$HOME/.config/composer');
    });

    test("macOS: paths has 2 entries: php prefix bin + composer vendor bin", async () => {
      const plan = await PhpRecipe.resolve(context);
      expect(plan.paths.length).toBe(2);
      expect(plan.paths[0]).toMatch(/\/bin$/);
      expect(plan.paths[1]).toBe('$HOME/.config/composer/vendor/bin');
    });
  }

  if (process.platform === 'linux') {
    test("linux: 2 steps with ids install-php and install-composer", async () => {
      const plan = await PhpRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(2);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toContain('install-php');
      expect(stepIds).toContain('install-composer');
    });

    test("linux: PHP step installs php-cli and extensions via apt-get", async () => {
      const plan = await PhpRecipe.resolve(context);
      const phpStep = plan.installSteps.find(s => s.id === 'install-php');
      expect(phpStep?.cmd).toContain('apt-get');
      expect(phpStep?.cmd).toContain('php-cli');
    });

    test("linux: Composer step uses the official installer via curl", async () => {
      const plan = await PhpRecipe.resolve(context);
      const composerStep = plan.installSteps.find(s => s.id === 'install-composer');
      expect(composerStep?.cmd).toContain('getcomposer.org');
      expect(composerStep?.checkCmd).toBe('which composer');
    });

    test("linux: COMPOSER_HOME is $HOME/.config/composer", async () => {
      const plan = await PhpRecipe.resolve(context);
      expect(plan.env['COMPOSER_HOME']).toBe('$HOME/.config/composer');
    });

    test("linux: paths is ['$HOME/.config/composer/vendor/bin']", async () => {
      const plan = await PhpRecipe.resolve(context);
      expect(plan.paths).toEqual(['$HOME/.config/composer/vendor/bin']);
    });
  }
});
