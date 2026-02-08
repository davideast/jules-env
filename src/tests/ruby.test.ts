import { describe, test, expect } from "bun:test";
import { RubyRecipe } from '../recipes/ruby';
import { UseContextSchema, ExecutionPlanSchema } from '../core/spec';

describe("Integration: Ruby Recipe", () => {
  const context = UseContextSchema.parse({
    runtime: 'ruby',
    dryRun: true,
  });

  test("resolves plan on current platform", async () => {
    const plan = await RubyRecipe.resolve(context);
    expect(plan.installSteps.length).toBeGreaterThan(0);
    for (const step of plan.installSteps) {
      expect(step.id).toBeDefined();
      expect(step.label).toBeDefined();
      expect(step.cmd).toBeDefined();
    }
  });

  test("sets GEM_HOME env var", async () => {
    const plan = await RubyRecipe.resolve(context);
    expect(plan.env['GEM_HOME']).toBeDefined();
    expect(plan.env['GEM_HOME']!.length).toBeGreaterThan(0);
  });

  test("paths include .gem/ruby/bin", async () => {
    const plan = await RubyRecipe.resolve(context);
    expect(plan.paths.some(p => p.includes('.gem/ruby/bin'))).toBe(true);
  });

  test("all install steps have string commands", async () => {
    const plan = await RubyRecipe.resolve(context);
    for (const step of plan.installSteps) {
      expect(typeof step.cmd).toBe('string');
    }
  });

  test("plan validates against ExecutionPlanSchema", async () => {
    const plan = await RubyRecipe.resolve(context);
    const parsed = ExecutionPlanSchema.parse(plan);
    expect(parsed).toBeDefined();
    expect(parsed.installSteps.length).toBe(plan.installSteps.length);
  });

  test("every step has a checkCmd", async () => {
    const plan = await RubyRecipe.resolve(context);
    for (const step of plan.installSteps) {
      expect(step.checkCmd).toBeDefined();
      expect(typeof step.checkCmd).toBe('string');
    }
  });

  test("does not set DART_SDK or FLUTTER_ROOT", async () => {
    const plan = await RubyRecipe.resolve(context);
    expect(plan.env['DART_SDK']).toBeUndefined();
    expect(plan.env['FLUTTER_ROOT']).toBeUndefined();
  });

  if (process.platform === 'darwin') {
    test("macOS: single install step uses brew install ruby", async () => {
      const plan = await RubyRecipe.resolve(context);
      const installStep = plan.installSteps.find(s => s.id === 'install-ruby');
      expect(installStep).toBeDefined();
      expect(installStep?.cmd).toBe('brew install ruby');
      expect(installStep?.checkCmd).toBe('brew list --versions ruby');
    });

    test("macOS: GEM_HOME is $HOME/.gem/ruby", async () => {
      const plan = await RubyRecipe.resolve(context);
      expect(plan.env['GEM_HOME']).toBe('$HOME/.gem/ruby');
    });

    test("macOS: paths has 2 entries: ruby prefix bin + gem bin", async () => {
      const plan = await RubyRecipe.resolve(context);
      expect(plan.paths.length).toBe(2);
      expect(plan.paths[0]).toMatch(/\/bin$/);
      expect(plan.paths[1]).toBe('$HOME/.gem/ruby/bin');
    });
  }

  if (process.platform === 'linux') {
    test("linux: has 2 steps: install-ruby-prereqs and install-ruby", async () => {
      const plan = await RubyRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(2);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toContain('install-ruby-prereqs');
      expect(stepIds).toContain('install-ruby');
    });

    test("linux: prerequisites step installs build-essential via apt-get", async () => {
      const plan = await RubyRecipe.resolve(context);
      const prereqs = plan.installSteps.find(s => s.id === 'install-ruby-prereqs');
      expect(prereqs?.cmd).toContain('apt-get');
      expect(prereqs?.cmd).toContain('build-essential');
    });

    test("linux: install step uses ruby-full via apt-get", async () => {
      const plan = await RubyRecipe.resolve(context);
      const installStep = plan.installSteps.find(s => s.id === 'install-ruby');
      expect(installStep?.cmd).toContain('apt-get');
      expect(installStep?.cmd).toContain('ruby-full');
    });

    test("linux: GEM_HOME is $HOME/.gem/ruby", async () => {
      const plan = await RubyRecipe.resolve(context);
      expect(plan.env['GEM_HOME']).toBe('$HOME/.gem/ruby');
    });

    test("linux: paths is ['$HOME/.gem/ruby/bin']", async () => {
      const plan = await RubyRecipe.resolve(context);
      expect(plan.paths).toEqual(['$HOME/.gem/ruby/bin']);
    });
  }
});
