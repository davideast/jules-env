import { describe, test, expect } from "bun:test";
import { DartRecipe } from '../recipes/dart';
import { UseContextSchema } from '../core/spec';

describe("Integration: Dart Recipe", () => {
    test("resolves plan correctly (dry-run)", async () => {
        const context = UseContextSchema.parse({
            runtime: 'dart',
            dryRun: true,
        });

        const plan = await DartRecipe.resolve(context);

        // 1. Check Install Step
        const installStep = plan.installSteps.find(s => s.id === 'install-dart');
        expect(installStep).toBeDefined();
        expect(installStep?.cmd).toBe('brew install dart-sdk');
        expect(installStep?.checkCmd).toBe('brew list --versions dart-sdk');

        // 2. Check Env
        // Note: DART_SDK path depends on system probe or fallback.
        // We expect it to be defined.
        expect(plan.env['DART_SDK']).toBeDefined();
        // Check structure (path/libexec)
        // Matches anything ending in /libexec
        expect(plan.env['DART_SDK']).toMatch(/\/libexec$/);

        // 3. Check Paths
        expect(plan.paths.length).toBeGreaterThan(0);
        // Matches anything ending in /bin
        expect(plan.paths[0]).toMatch(/\/bin$/);
    });
});
