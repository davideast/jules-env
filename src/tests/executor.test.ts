import { describe, test, expect, afterAll } from "bun:test";
import { executePlan, julesStateDir, shellenvPath } from '../core/executor';
import { ExecutionPlanSchema } from '../core/spec';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { existsSync, unlinkSync, readFileSync, rmSync, mkdtempSync, mkdirSync, appendFileSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';

// Redirect persisted state into a throwaway directory for the whole file.
// Without this the suite deletes and rewrites the developer's real
// ~/.jules/shellenv, which is the very file this tool exists to produce.
process.env['JULES_HOME'] = mkdtempSync(join(tmpdir(), 'jules-home-'));

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
        const julesDir = julesStateDir();
        const stateFile = shellenvPath();
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
        const homeStateFile = shellenvPath();
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
            const homeStateFile = shellenvPath();
            if (existsSync(homeStateFile)) unlinkSync(homeStateFile);
        }
    });

    test("auto-sources .jules/shellenv before command", async () => {
        const julesDir = julesStateDir();
        const stateFile = shellenvPath();

        // Ensure directory exists
        if (!existsSync(julesDir)) mkdirSync(julesDir, { recursive: true });

        // Add a test variable to shellenv
        appendFileSync(stateFile, 'export JULES_TEST_VAR="sourced"\n');

        const outputFile = join(tmpdir(), `jules-source-test-${Date.now()}.txt`);

        const plan = ExecutionPlanSchema.parse({
            installSteps: [{
                id: 'test-source',
                label: 'Test Sourcing',
                cmd: `echo $JULES_TEST_VAR > ${outputFile}`,
            }],
            env: {},
            paths: [],
            files: [],
        });

        try {
            await executePlan(plan, false);
            expect(existsSync(outputFile)).toBe(true);
            expect(readFileSync(outputFile, 'utf-8').trim()).toBe('sourced');
        } finally {
            if (existsSync(outputFile)) unlinkSync(outputFile);
            // We don't delete shellenv here as other tests might rely on it or it might be the user's
            // In a real environment we might want to backup/restore, but for now appending is safer than deleting
        }
    });

    test("checkCmd skips step when check passes", async () => {
        const markerFile = join(tmpdir(), `jules-checkskip-${Date.now()}.txt`);

        const plan = ExecutionPlanSchema.parse({
            installSteps: [{
                id: 'should-skip',
                label: 'Should be skipped',
                cmd: `echo ran > ${markerFile}`,
                checkCmd: 'true',
            }],
            env: {},
            paths: [],
            files: [],
        });

        await executePlan(plan, false);

        // cmd should NOT have run because checkCmd exited 0
        expect(existsSync(markerFile)).toBe(false);
    });

    test("checkCmd runs step when check fails", async () => {
        const markerFile = join(tmpdir(), `jules-checkfail-${Date.now()}.txt`);

        const plan = ExecutionPlanSchema.parse({
            installSteps: [{
                id: 'should-run',
                label: 'Should run',
                cmd: `echo ran > ${markerFile}`,
                checkCmd: 'false',
            }],
            env: {},
            paths: [],
            files: [],
        });

        try {
            await executePlan(plan, false);
            expect(existsSync(markerFile)).toBe(true);
        } finally {
            if (existsSync(markerFile)) unlinkSync(markerFile);
        }
    });

    test("checkCmd works when shellenv does not exist", async () => {
        const julesDir = julesStateDir();
        const stateFile = shellenvPath();
        const markerFile = join(tmpdir(), `jules-noenv-${Date.now()}.txt`);

        // Temporarily remove shellenv if it exists
        let backup: string | null = null;
        if (existsSync(stateFile)) {
            backup = readFileSync(stateFile, 'utf-8');
            unlinkSync(stateFile);
        }

        const plan = ExecutionPlanSchema.parse({
            installSteps: [{
                id: 'check-without-shellenv',
                label: 'Check without shellenv',
                cmd: `echo ran > ${markerFile}`,
                checkCmd: 'true',
            }],
            env: {},
            paths: [],
            files: [],
        });

        try {
            await executePlan(plan, false);
            // checkCmd should have succeeded (exited 0), so cmd should NOT run
            expect(existsSync(markerFile)).toBe(false);
        } finally {
            // Restore shellenv
            if (backup !== null) {
                if (!existsSync(julesDir)) mkdirSync(julesDir, { recursive: true });
                appendFileSync(stateFile, backup);
            }
            if (existsSync(markerFile)) unlinkSync(markerFile);
        }
    });

    // NOTE: Testing stdout capture in this environment is tricky without spawning a child process for the test itself.
    // However, we can verify that the label parameter is accepted and doesn't crash.
    test("accepts label parameter", async () => {
         const plan = ExecutionPlanSchema.parse({
            installSteps: [],
            env: {},
            paths: [],
            files: [],
        });

        // Should not throw
        await executePlan(plan, true, "My Label");
    });
});

describe("Executor state directory", () => {
    const savedJulesHome = process.env['JULES_HOME'];

    function withStateDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
        const dir = mkdtempSync(join(tmpdir(), 'jules-state-'));
        process.env['JULES_HOME'] = dir;
        return fn(dir).finally(() => {
            if (savedJulesHome === undefined) {
                delete process.env['JULES_HOME'];
            } else {
                process.env['JULES_HOME'] = savedJulesHome;
            }
        });
    }

    test("JULES_HOME redirects shellenv away from the user's home directory", async () => {
        // Deliberately the REAL home path, not shellenvPath(), so this asserts
        // the user's own file is left alone.
        const homeStateFile = join(homedir(), '.jules', 'shellenv');
        const homeExistedBefore = existsSync(homeStateFile);
        const homeContentBefore = homeExistedBefore ? readFileSync(homeStateFile, 'utf-8') : null;

        await withStateDir(async (dir) => {
            const plan = ExecutionPlanSchema.parse({
                installSteps: [],
                env: { "SCOPED_VAR": "SCOPED_VAL" },
                paths: ["/scoped/path"],
                files: [],
            });

            await executePlan(plan, false);

            const scopedContent = readFileSync(join(dir, 'shellenv'), 'utf-8');
            expect(scopedContent).toContain('export SCOPED_VAR="SCOPED_VAL"');
            expect(scopedContent).toContain('export PATH="/scoped/path:$PATH"');
        });

        // The real home shellenv must be exactly as we found it.
        expect(existsSync(homeStateFile)).toBe(homeExistedBefore);
        if (homeContentBefore !== null) {
            expect(readFileSync(homeStateFile, 'utf-8')).toBe(homeContentBefore);
        }
    });

    test("does not duplicate exports when the same plan runs repeatedly", async () => {
        await withStateDir(async (dir) => {
            const plan = ExecutionPlanSchema.parse({
                installSteps: [],
                env: { "DUP_VAR": "once" },
                paths: ["/dup/bin"],
                files: [],
            });

            await executePlan(plan, false);
            await executePlan(plan, false);
            await executePlan(plan, false);

            const lines = readFileSync(join(dir, 'shellenv'), 'utf-8').split('\n').filter(Boolean);

            expect(lines.filter(l => l === 'export DUP_VAR="once"')).toHaveLength(1);
            expect(lines.filter(l => l === 'export PATH="/dup/bin:$PATH"')).toHaveLength(1);
        });
    });

    test("still appends entries contributed by a different recipe", async () => {
        await withStateDir(async (dir) => {
            await executePlan(ExecutionPlanSchema.parse({
                installSteps: [], env: { "FIRST": "1" }, paths: ["/first/bin"], files: [],
            }), false);
            await executePlan(ExecutionPlanSchema.parse({
                installSteps: [], env: { "SECOND": "2" }, paths: ["/second/bin"], files: [],
            }), false);

            const content = readFileSync(join(dir, 'shellenv'), 'utf-8');

            expect(content).toContain('export FIRST="1"');
            expect(content).toContain('export SECOND="2"');
            expect(content).toContain('export PATH="/first/bin:$PATH"');
            expect(content).toContain('export PATH="/second/bin:$PATH"');
        });
    });

    test("checkCmd sources the shellenv from JULES_HOME", async () => {
        await withStateDir(async (dir) => {
            mkdirSync(dir, { recursive: true });
            appendFileSync(join(dir, 'shellenv'), 'export SCOPED_SENTINEL="found"\n');

            const marker = join(tmpdir(), `jules-scoped-${Date.now()}.txt`);
            const plan = ExecutionPlanSchema.parse({
                installSteps: [{
                    id: 'scoped',
                    label: 'Scoped step',
                    // Only runs when the check FAILS, so the marker appearing
                    // means the sentinel was not sourced.
                    cmd: `touch ${marker}`,
                    checkCmd: 'test "$SCOPED_SENTINEL" = "found"',
                }],
                env: {},
                paths: [],
                files: [],
            });

            await executePlan(plan, false);

            expect(existsSync(marker)).toBe(false);
        });
    });
});

describe("Executor file paths", () => {
    // Bun's os.homedir() does not track runtime changes to process.env.HOME,
    // so the home directory has to be set for a child process instead.
    test("expands a leading ~ in a file path to the home directory", () => {
        const fakeHome = mkdtempSync(join(tmpdir(), 'jules-tilde-home-'));
        const workDir = mkdtempSync(join(tmpdir(), 'jules-tilde-cwd-'));
        const executorPath = join(import.meta.dir, '..', 'core', 'executor.ts');

        const script = `
            import { executePlan } from ${JSON.stringify(executorPath)};
            await executePlan({
                installSteps: [], env: {}, paths: [],
                files: [{ path: '~/notes/hello.txt', content: 'hi' }],
            }, false);
        `;

        const result = spawnSync(process.execPath, ['-e', script], {
            encoding: 'utf-8',
            cwd: workDir,
            env: { ...process.env, HOME: fakeHome, JULES_HOME: join(fakeHome, '.jules') },
        });

        expect(result.status).toBe(0);
        expect(existsSync(join(fakeHome, 'notes', 'hello.txt'))).toBe(true);
        expect(readFileSync(join(fakeHome, 'notes', 'hello.txt'), 'utf-8')).toBe('hi');
        // A literal ~ directory next to the caller means no expansion happened.
        expect(existsSync(join(workDir, '~'))).toBe(false);
    });

    test("leaves absolute file paths untouched", async () => {
        const dir = mkdtempSync(join(tmpdir(), 'jules-abs-'));
        const target = join(dir, 'sub', 'file.txt');

        await executePlan(ExecutionPlanSchema.parse({
            installSteps: [],
            env: {},
            paths: [],
            files: [{ path: target, content: 'abs' }],
        }), false);

        expect(readFileSync(target, 'utf-8')).toBe('abs');
    });
});
