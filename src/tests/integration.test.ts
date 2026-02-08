import { describe, test, expect } from "bun:test";
import { DartRecipe } from '../recipes/dart';
import { UseContextSchema } from '../core/spec';
import { loadDataRecipe } from '../core/loader';
import ollamaData from '../recipes/ollama.json';

describe("Integration: Dart Recipe", () => {
    test("resolves plan correctly (dry-run)", async () => {
        const context = UseContextSchema.parse({
            runtime: 'dart',
            dryRun: true,
        });

        const plan = await DartRecipe.resolve(context);

        if (process.platform === 'darwin') {
            // macOS: single brew install step
            const installStep = plan.installSteps.find(s => s.id === 'install-dart');
            expect(installStep).toBeDefined();
            expect(installStep?.cmd).toBe('brew install dart-sdk');
            expect(installStep?.checkCmd).toBe('brew list --versions dart-sdk');

            expect(plan.env['DART_SDK']).toBeDefined();
            expect(plan.env['DART_SDK']).toMatch(/\/libexec$/);

            expect(plan.paths.length).toBeGreaterThan(0);
            expect(plan.paths[0]).toMatch(/\/bin$/);
        } else if (process.platform === 'linux') {
            // Linux: four apt install steps
            expect(plan.installSteps.length).toBe(4);

            const stepIds = plan.installSteps.map(s => s.id);
            expect(stepIds).toContain('install-dart-prereqs');
            expect(stepIds).toContain('add-dart-signing-key');
            expect(stepIds).toContain('add-dart-repo');
            expect(stepIds).toContain('install-dart');

            const prereqs = plan.installSteps.find(s => s.id === 'install-dart-prereqs');
            expect(prereqs?.cmd).toContain('apt-get');
            expect(prereqs?.checkCmd).toContain('dpkg -s');

            const installStep = plan.installSteps.find(s => s.id === 'install-dart');
            expect(installStep?.cmd).toContain('apt-get');
            expect(installStep?.checkCmd).toBe('dpkg -s dart');

            expect(plan.env['DART_SDK']).toBe('/usr/lib/dart');
            expect(plan.paths).toEqual(['/usr/lib/dart/bin']);
        }
    });
});

describe("Integration: Ollama Recipe", () => {
    test("requires --preset to specify a model", async () => {
        const recipe = loadDataRecipe(ollamaData);
        const context = UseContextSchema.parse({
            runtime: 'ollama',
            dryRun: true,
        });

        expect(recipe.resolve(context)).rejects.toThrow("Missing required variable: {{preset}}");
    });

    test("resolves plan with preset model", async () => {
        const recipe = loadDataRecipe(ollamaData);
        const context = UseContextSchema.parse({
            runtime: 'ollama',
            preset: 'embeddinggemma',
            dryRun: true,
        });

        const plan = await recipe.resolve(context);

        // Check all expected step ids exist
        const stepIds = plan.installSteps.map(s => s.id);
        expect(stepIds).toContain('install-zstd');
        expect(stepIds).toContain('install-ollama');
        expect(stepIds).toContain('enable-ollama');
        expect(stepIds).toContain('wait-for-ollama');
        expect(stepIds).toContain('pull-model');

        const pullStep = plan.installSteps.find(s => s.id === 'pull-model');
        expect(pullStep?.cmd).toBe('ollama pull embeddinggemma');
        expect(pullStep?.checkCmd).toBe('ollama list | grep embeddinggemma');

        // Check pipe/chain commands are preserved
        const installOllama = plan.installSteps.find(s => s.id === 'install-ollama');
        expect(installOllama?.cmd).toBe('curl -fsSL https://ollama.com/install.sh | sh');

        const enableOllama = plan.installSteps.find(s => s.id === 'enable-ollama');
        expect(enableOllama?.cmd).toContain('&&');
    });

    test("uses --preset to override model", async () => {
        const recipe = loadDataRecipe(ollamaData);
        const context = UseContextSchema.parse({
            runtime: 'ollama',
            preset: 'phi4-mini:latest',
        });

        const plan = await recipe.resolve(context);

        const pullStep = plan.installSteps.find(s => s.id === 'pull-model');
        expect(pullStep?.label).toBe('Pull phi4-mini:latest model');
        expect(pullStep?.cmd).toBe('ollama pull phi4-mini:latest');
        expect(pullStep?.checkCmd).toBe('ollama list | grep phi4-mini:latest');
    });

    test("sets OLLAMA_HOST env var", async () => {
        const recipe = loadDataRecipe(ollamaData);
        const context = UseContextSchema.parse({ runtime: 'ollama', preset: 'any-model' });
        const plan = await recipe.resolve(context);

        expect(plan.env['OLLAMA_HOST']).toBe('http://localhost:11434');
    });
});
