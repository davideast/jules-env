import { describe, test, expect } from "bun:test";
import { SwiftRecipe } from '../recipes/swift';
import { UseContextSchema, ExecutionPlanSchema } from '../core/spec';

describe("Integration: Swift Recipe", () => {
  const context = UseContextSchema.parse({
    runtime: 'swift',
    dryRun: true,
  });

  test("resolves plan on current platform", async () => {
    const plan = await SwiftRecipe.resolve(context);
    expect(plan.installSteps.length).toBeGreaterThan(0);
    for (const step of plan.installSteps) {
      expect(step.id).toBeDefined();
      expect(step.label).toBeDefined();
      expect(step.cmd).toBeDefined();
    }
  });

  test("sets SWIFT_PATH env var", async () => {
    const plan = await SwiftRecipe.resolve(context);
    expect(plan.env['SWIFT_PATH']).toBeDefined();
    expect(plan.env['SWIFT_PATH']!.length).toBeGreaterThan(0);
  });

  test("all install steps have string commands", async () => {
    const plan = await SwiftRecipe.resolve(context);
    for (const step of plan.installSteps) {
      expect(typeof step.cmd).toBe('string');
    }
  });

  test("plan validates against ExecutionPlanSchema", async () => {
    const plan = await SwiftRecipe.resolve(context);
    const parsed = ExecutionPlanSchema.parse(plan);
    expect(parsed).toBeDefined();
    expect(parsed.installSteps.length).toBe(plan.installSteps.length);
  });

  test("every step has a checkCmd", async () => {
    const plan = await SwiftRecipe.resolve(context);
    for (const step of plan.installSteps) {
      expect(step.checkCmd).toBeDefined();
      expect(typeof step.checkCmd).toBe('string');
    }
  });

  if (process.platform === 'darwin') {
    test("macOS: single install step uses brew install swift", async () => {
      const plan = await SwiftRecipe.resolve(context);
      const installStep = plan.installSteps.find(s => s.id === 'install-swift');
      expect(installStep).toBeDefined();
      expect(installStep?.cmd).toBe('brew install swift');
      expect(installStep?.checkCmd).toBe('brew list --versions swift');
    });

    test("macOS: SWIFT_PATH derived from brew prefix", async () => {
      const plan = await SwiftRecipe.resolve(context);
      // It might be difficult to assert the exact value since it depends on brew being installed or not
      // But we can check it ends with /bin
      expect(plan.env['SWIFT_PATH']).toMatch(/\/bin$/);
    });

    test("macOS: paths has 1 entry ending in /bin", async () => {
      const plan = await SwiftRecipe.resolve(context);
      expect(plan.paths.length).toBe(1);
      expect(plan.paths[0]).toMatch(/\/bin$/);
    });
  }

  if (process.platform === 'linux') {
    test("linux: has 2 steps: install-swift-prereqs and install-swift-tarball", async () => {
      const plan = await SwiftRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(2);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toContain('install-swift-prereqs');
      expect(stepIds).toContain('install-swift-tarball');
    });

    test("linux: prerequisites step installs libraries via apt-get", async () => {
      const plan = await SwiftRecipe.resolve(context);
      const prereqs = plan.installSteps.find(s => s.id === 'install-swift-prereqs');
      expect(prereqs?.cmd).toContain('apt-get');
      expect(prereqs?.cmd).toContain('libcurl4-openssl-dev');
    });

    test("linux: install step uses curl and tar", async () => {
      const plan = await SwiftRecipe.resolve(context);
      const installStep = plan.installSteps.find(s => s.id === 'install-swift-tarball');
      expect(installStep?.cmd).toContain('curl');
      expect(installStep?.cmd).toContain('tar');
      expect(installStep?.cmd).toContain('swift-6.1-RELEASE');
    });

    test("linux: SWIFT_PATH is /usr/local/bin", async () => {
      const plan = await SwiftRecipe.resolve(context);
      expect(plan.env['SWIFT_PATH']).toBe('/usr/local/bin');
    });

    test("linux: paths is ['/usr/local/bin']", async () => {
      const plan = await SwiftRecipe.resolve(context);
      expect(plan.paths).toEqual(['/usr/local/bin']);
    });
  }
});
