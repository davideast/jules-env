import { describe, test, expect } from "bun:test";
import { FlutterRecipe } from '../recipes/flutter';
import { UseContextSchema, ExecutionPlanSchema } from '../core/spec';

describe("Integration: Flutter Recipe", () => {
  const context = UseContextSchema.parse({
    runtime: 'flutter',
    dryRun: true,
  });

  test("resolves plan on current platform", async () => {
    const plan = await FlutterRecipe.resolve(context);
    expect(plan.installSteps.length).toBeGreaterThan(0);
    for (const step of plan.installSteps) {
      expect(step.id).toBeDefined();
      expect(step.label).toBeDefined();
      expect(step.cmd).toBeDefined();
    }
  });

  test("sets FLUTTER_ROOT env var", async () => {
    const plan = await FlutterRecipe.resolve(context);
    expect(plan.env['FLUTTER_ROOT']).toBeDefined();
    expect(plan.env['FLUTTER_ROOT']!.length).toBeGreaterThan(0);
  });

  test("adds flutter/bin to paths", async () => {
    const plan = await FlutterRecipe.resolve(context);
    expect(plan.paths.length).toBeGreaterThan(0);
    expect(plan.paths.some(p => p.endsWith('/bin'))).toBe(true);
  });

  test("includes web precache step", async () => {
    const plan = await FlutterRecipe.resolve(context);
    const precacheStep = plan.installSteps.find(s => s.id === 'precache-web');
    expect(precacheStep).toBeDefined();
    expect(precacheStep?.cmd).toContain('flutter precache --web');
  });

  test("all install steps have string commands", async () => {
    const plan = await FlutterRecipe.resolve(context);
    for (const step of plan.installSteps) {
      expect(typeof step.cmd).toBe('string');
    }
  });

  if (process.platform === 'darwin') {
    test("macOS: install step uses brew install --cask flutter", async () => {
      const plan = await FlutterRecipe.resolve(context);
      const installStep = plan.installSteps.find(s => s.id === 'install-flutter');
      expect(installStep).toBeDefined();
      expect(installStep?.cmd).toBe('brew install --cask flutter');
      expect(installStep?.checkCmd).toBe('brew list --cask flutter');
    });

    test("macOS: FLUTTER_ROOT is non-empty", async () => {
      const plan = await FlutterRecipe.resolve(context);
      expect(plan.env['FLUTTER_ROOT']!.length).toBeGreaterThan(0);
    });

    test("macOS: paths entry ends with /bin", async () => {
      const plan = await FlutterRecipe.resolve(context);
      expect(plan.paths[0]).toMatch(/\/bin$/);
    });
  }

  if (process.platform === 'linux') {
    test("linux: has 3 steps: install-flutter-prereqs, clone-flutter, precache-web", async () => {
      const plan = await FlutterRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(3);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toContain('install-flutter-prereqs');
      expect(stepIds).toContain('clone-flutter');
      expect(stepIds).toContain('precache-web');
    });

    test("linux: prerequisites step installs via apt-get", async () => {
      const plan = await FlutterRecipe.resolve(context);
      const prereqs = plan.installSteps.find(s => s.id === 'install-flutter-prereqs');
      expect(prereqs?.cmd).toContain('apt-get');
    });

    test("linux: clone step uses git clone with -b stable", async () => {
      const plan = await FlutterRecipe.resolve(context);
      const cloneStep = plan.installSteps.find(s => s.id === 'clone-flutter');
      expect(cloneStep?.cmd).toContain('git clone');
      expect(cloneStep?.cmd).toContain('-b stable');
    });

    test("linux: clone step checkCmd uses test -d /usr/local/flutter", async () => {
      const plan = await FlutterRecipe.resolve(context);
      const cloneStep = plan.installSteps.find(s => s.id === 'clone-flutter');
      expect(cloneStep?.checkCmd).toBe('test -d /usr/local/flutter');
    });

    test("linux: FLUTTER_ROOT is /usr/local/flutter", async () => {
      const plan = await FlutterRecipe.resolve(context);
      expect(plan.env['FLUTTER_ROOT']).toBe('/usr/local/flutter');
    });

    test("linux: paths is ['/usr/local/flutter/bin']", async () => {
      const plan = await FlutterRecipe.resolve(context);
      expect(plan.paths).toEqual(['/usr/local/flutter/bin']);
    });
  }

  test("plan validates against ExecutionPlanSchema", async () => {
    const plan = await FlutterRecipe.resolve(context);
    const parsed = ExecutionPlanSchema.parse(plan);
    expect(parsed).toBeDefined();
    expect(parsed.installSteps.length).toBe(plan.installSteps.length);
  });

  test("every step has a checkCmd", async () => {
    const plan = await FlutterRecipe.resolve(context);
    for (const step of plan.installSteps) {
      expect(step.checkCmd).toBeDefined();
      expect(typeof step.checkCmd).toBe('string');
    }
  });

  test("does not set DART_SDK", async () => {
    const plan = await FlutterRecipe.resolve(context);
    expect(plan.env['DART_SDK']).toBeUndefined();
  });
});
