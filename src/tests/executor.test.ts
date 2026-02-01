import { describe, test, expect, afterAll } from "bun:test";
import { executePlan } from '../core/executor';
import { ExecutionPlanSchema } from '../core/spec';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, unlinkSync, readFileSync, rmSync } from 'node:fs';

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
});
