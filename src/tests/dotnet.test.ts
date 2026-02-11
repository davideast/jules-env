import { describe, test, expect } from "bun:test";
import { DotnetRecipe } from '../recipes/dotnet';
import { UseContextSchema, ExecutionPlanSchema } from '../core/spec';

describe("Integration: Dotnet Recipe", () => {
  const context = UseContextSchema.parse({
    runtime: 'dotnet',
    dryRun: true,
  });

  test("resolves plan on current platform", async () => {
    const plan = await DotnetRecipe.resolve(context);
    expect(plan.installSteps.length).toBeGreaterThan(0);
    for (const step of plan.installSteps) {
      expect(step.id).toBeDefined();
      expect(step.label).toBeDefined();
      expect(step.cmd).toBeDefined();
    }
  });

  test("sets DOTNET_ROOT env var", async () => {
    const plan = await DotnetRecipe.resolve(context);
    expect(plan.env['DOTNET_ROOT']).toBeDefined();
    expect(plan.env['DOTNET_ROOT']!.length).toBeGreaterThan(0);
  });

  test("paths include .dotnet/tools", async () => {
    const plan = await DotnetRecipe.resolve(context);
    expect(plan.paths.some(p => p.includes('.dotnet/tools'))).toBe(true);
  });

  test("all install steps have string commands", async () => {
    const plan = await DotnetRecipe.resolve(context);
    for (const step of plan.installSteps) {
      expect(typeof step.cmd).toBe('string');
    }
  });

  test("plan validates against ExecutionPlanSchema", async () => {
    const plan = await DotnetRecipe.resolve(context);
    const parsed = ExecutionPlanSchema.parse(plan);
    expect(parsed).toBeDefined();
    expect(parsed.installSteps.length).toBe(plan.installSteps.length);
  });

  test("every step has a checkCmd", async () => {
    const plan = await DotnetRecipe.resolve(context);
    for (const step of plan.installSteps) {
      expect(step.checkCmd).toBeDefined();
      expect(typeof step.checkCmd).toBe('string');
    }
  });

  if (process.platform === 'darwin') {
    test("macOS: single install step uses brew install dotnet-sdk", async () => {
      const plan = await DotnetRecipe.resolve(context);
      const installStep = plan.installSteps.find(s => s.id === 'install-dotnet-sdk');
      expect(installStep).toBeDefined();
      expect(installStep?.cmd).toBe('brew install dotnet-sdk');
      expect(installStep?.checkCmd).toBe('brew list --versions dotnet-sdk');
    });

    test("macOS: DOTNET_ROOT points to libexec", async () => {
      const plan = await DotnetRecipe.resolve(context);
      expect(plan.env['DOTNET_ROOT']).toMatch(/\/libexec$/);
    });

    test("macOS: paths has 2 entries: dotnet bin + tools", async () => {
      const plan = await DotnetRecipe.resolve(context);
      expect(plan.paths.length).toBe(2);
      expect(plan.paths[0]).toMatch(/\/bin$/);
      expect(plan.paths[1]).toBe('$HOME/.dotnet/tools');
    });
  }

  if (process.platform === 'linux') {
    test("linux: has 4 steps", async () => {
      const plan = await DotnetRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(4);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toContain('install-dotnet-prereqs');
      expect(stepIds).toContain('add-microsoft-signing-key');
      expect(stepIds).toContain('add-microsoft-repo');
      expect(stepIds).toContain('install-dotnet-sdk');
    });

    test("linux: prerequisites step installs apt-transport-https and wget", async () => {
      const plan = await DotnetRecipe.resolve(context);
      const prereqs = plan.installSteps.find(s => s.id === 'install-dotnet-prereqs');
      expect(prereqs?.cmd).toContain('apt-transport-https');
      expect(prereqs?.cmd).toContain('wget');
    });

    test("linux: install step uses dotnet-sdk-8.0", async () => {
      const plan = await DotnetRecipe.resolve(context);
      const installStep = plan.installSteps.find(s => s.id === 'install-dotnet-sdk');
      expect(installStep?.cmd).toContain('dotnet-sdk-8.0');
    });

    test("linux: DOTNET_ROOT is /usr/lib/dotnet", async () => {
      const plan = await DotnetRecipe.resolve(context);
      expect(plan.env['DOTNET_ROOT']).toBe('/usr/lib/dotnet');
    });

    test("linux: paths include /usr/lib/dotnet and tools", async () => {
      const plan = await DotnetRecipe.resolve(context);
      expect(plan.paths).toContain('/usr/lib/dotnet');
      expect(plan.paths).toContain('$HOME/.dotnet/tools');
    });
  }
});
