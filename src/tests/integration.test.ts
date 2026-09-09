import { describe, test, expect } from "bun:test";
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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
    test("uses default preset when --preset is not specified", async () => {
        const recipe = loadDataRecipe(ollamaData);
        const context = UseContextSchema.parse({
            runtime: 'ollama',
            dryRun: true,
        });

        const plan = await recipe.resolve(context);
        const pullStep = plan.installSteps.find(s => s.id === 'pull-model');
        expect(pullStep?.cmd).toBe('ollama pull gemma3');
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
        // Asserts the preset was substituted, not how the check is spelled.
        expect(pullStep?.checkCmd).toContain('embeddinggemma');
        expect(pullStep?.checkCmd).not.toContain('{{preset}}');

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
        expect(pullStep?.checkCmd).toContain('phi4-mini:latest');
        expect(pullStep?.checkCmd).not.toContain('{{preset}}');
    });

    test("sets OLLAMA_HOST env var", async () => {
        const recipe = loadDataRecipe(ollamaData);
        const context = UseContextSchema.parse({ runtime: 'ollama', preset: 'any-model' });
        const plan = await recipe.resolve(context);

        expect(plan.env['OLLAMA_HOST']).toBe('http://localhost:11434');
    });
});


describe("Integration: Ollama model check", () => {
    /**
     * Runs a step's checkCmd against a stub `ollama` whose `list` output is
     * controlled, and reports whether the check passed. A passing check means
     * the pull step gets skipped.
     */
    function checkPasses(checkCmd: string, listOutput: string): boolean {
        const dir = mkdtempSync(join(tmpdir(), 'jules-ollama-'));
        const listFile = join(dir, 'list.txt');
        writeFileSync(listFile, listOutput);
        writeFileSync(
            join(dir, 'ollama'),
            '#!/bin/sh\nif [ "$1" = "list" ]; then cat "$OLLAMA_FAKE_LIST"; fi\n',
            { mode: 0o755 },
        );

        const result = spawnSync('sh', ['-c', checkCmd], {
            encoding: 'utf-8',
            env: { ...process.env, PATH: `${dir}:${process.env['PATH']}`, OLLAMA_FAKE_LIST: listFile },
        });
        return result.status === 0;
    }

    const HEADER = 'NAME                ID              SIZE      MODIFIED\n';

    async function pullCheckFor(preset: string): Promise<string> {
        const recipe = loadDataRecipe(ollamaData);
        const plan = await recipe.resolve(UseContextSchema.parse({ runtime: 'ollama', preset }));
        return plan.installSteps.find(s => s.id === 'pull-model')!.checkCmd!;
    }

    test("a different model sharing a name prefix does not satisfy the check", async () => {
        const checkCmd = await pullCheckFor('llama3');
        const installed = HEADER + 'llama3.1:latest     42182419e950    4.7 GB    2 days ago\n';

        expect(checkPasses(checkCmd, installed)).toBe(false);
    });

    test("the requested model does satisfy the check", async () => {
        const checkCmd = await pullCheckFor('llama3');
        const installed = HEADER + 'llama3:latest       365c0bd3c000    4.7 GB    2 days ago\n';

        expect(checkPasses(checkCmd, installed)).toBe(true);
    });

    test("an explicitly tagged preset matches its own tag", async () => {
        const checkCmd = await pullCheckFor('llama3.1:8b');
        const installed = HEADER + 'llama3.1:8b         42182419e950    4.7 GB    2 days ago\n';

        expect(checkPasses(checkCmd, installed)).toBe(true);
    });

    test("nothing installed does not satisfy the check", async () => {
        const checkCmd = await pullCheckFor('llama3');

        expect(checkPasses(checkCmd, HEADER)).toBe(false);
    });
});
