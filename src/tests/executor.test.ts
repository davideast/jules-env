import { describe, test, expect, afterAll } from "bun:test";
import { executePlan } from '../core/executor';
import { ExecutionPlanSchema } from '../core/spec';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { existsSync, unlinkSync, readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { execSync } from 'node:child_process';

describe("Executor", () => {
    const tempFile = join(tmpdir(), `jules-test-${Date.now()}.txt`);
    const dryRunFile = join(tmpdir(), `jules-dry-test-${Date.now()}.txt`);
    const nestedDir = join(tmpdir(), `jules-nested-${Date.now()}`);
    const nestedFile = join(nestedDir, 'nested', 'file.txt');

    afterAll(() => {
        if (existsSync(tempFile)) {
            unlinkSync(tempFile);
        }
        if (existsSync(dryRunFile)) {
             unlinkSync(dryRunFile);
        }
        if (existsSync(nestedDir)) {
            rmSync(nestedDir, { recursive: true, force: true });
        }
    });

    test("writes files correctly in non-dry-run", async () => {
        const plan = ExecutionPlanSchema.parse({
            installSteps: [],
            env: {},
            paths: [],
            files: [{
                path: tempFile,
                content: "Hello, Jules!",
            }],
        });

        await executePlan(plan, false);

        expect(existsSync(tempFile)).toBe(true);
        expect(readFileSync(tempFile, 'utf-8')).toBe("Hello, Jules!");
    });

    test("does not write files in dry-run", async () => {
         const plan = ExecutionPlanSchema.parse({
            installSteps: [],
            env: {},
            paths: [],
            files: [{
                path: dryRunFile,
                content: "Should not exist",
            }],
        });

        await executePlan(plan, true);

        expect(existsSync(dryRunFile)).toBe(false);
    });

    test("creates directories if they do not exist", async () => {
        const plan = ExecutionPlanSchema.parse({
            installSteps: [],
            env: {},
            paths: [],
            files: [{
                path: nestedFile,
                content: "Nested Hello",
            }],
        });

        await executePlan(plan, false);

        expect(existsSync(nestedFile)).toBe(true);
        expect(readFileSync(nestedFile, 'utf-8')).toBe("Nested Hello");
    });

    test("writes env vars and paths to ~/.jules/shellenv", async () => {
        const plan = ExecutionPlanSchema.parse({
            installSteps: [],
            env: { "TEST_VAR": "TEST_VAL" },
            paths: ["/test/path"],
            files: [],
        });

        // Clean up ~/.jules/shellenv before test
        const julesDir = join(homedir(), '.jules');
        const stateFile = join(julesDir, 'shellenv');
        if (existsSync(stateFile)) unlinkSync(stateFile);

        await executePlan(plan, false);

        expect(existsSync(stateFile)).toBe(true);
        const content = readFileSync(stateFile, 'utf-8');
        expect(content).toContain('export PATH="/test/path:$PATH"');
        expect(content).toContain('export TEST_VAR="TEST_VAL"');

        // Cleanup
        unlinkSync(stateFile);
    });

    test("does not write to project directory", async () => {
        const plan = ExecutionPlanSchema.parse({
            installSteps: [],
            env: { "FOO": "BAR" },
            paths: ["/some/path"],
            files: [],
        });

        const cwdJulesDir = join(process.cwd(), '.jules');
        // Remove if it exists before the test
        if (existsSync(cwdJulesDir)) rmSync(cwdJulesDir, { recursive: true, force: true });

        await executePlan(plan, false);

        expect(existsSync(cwdJulesDir)).toBe(false);

        // Cleanup home shellenv
        const homeStateFile = join(homedir(), '.jules', 'shellenv');
        if (existsSync(homeStateFile)) unlinkSync(homeStateFile);
    });

    test("git working tree stays clean after execution", async () => {
        const tempRepo = mkdtempSync(join(tmpdir(), 'jules-git-test-'));
        const originalCwd = process.cwd();

        try {
            // Init a git repo and create an initial commit
            execSync('git init', { cwd: tempRepo, stdio: 'ignore' });
            execSync('git config user.email "test@test.com"', { cwd: tempRepo, stdio: 'ignore' });
            execSync('git config user.name "Test"', { cwd: tempRepo, stdio: 'ignore' });
            execSync('git commit --allow-empty -m "init"', { cwd: tempRepo, stdio: 'ignore' });

            process.chdir(tempRepo);

            const plan = ExecutionPlanSchema.parse({
                installSteps: [],
                env: { "GIT_TEST": "value" },
                paths: ["/git/test/path"],
                files: [],
            });

            await executePlan(plan, false);

            const status = execSync('git status --porcelain', { cwd: tempRepo, encoding: 'utf-8' });
            expect(status.trim()).toBe('');
        } finally {
            process.chdir(originalCwd);
            rmSync(tempRepo, { recursive: true, force: true });

            // Cleanup home shellenv
            const homeStateFile = join(homedir(), '.jules', 'shellenv');
            if (existsSync(homeStateFile)) unlinkSync(homeStateFile);
        }
    });
});
