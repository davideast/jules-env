import { describe, test, expect } from "bun:test";
import { firebaseTools } from '../recipes/firebase-tools';
import { UseContextSchema } from '../core/spec';

describe("Integration: firebase-tools Recipe", () => {
    test("resolves plan with npm install and emulator setups (dry-run)", async () => {
        const context = UseContextSchema.parse({
            runtime: 'firebase-tools',
            dryRun: true,
        });

        // Resolve the plan based on the recipe
        const plan = await firebaseTools.resolve(context);
        const cmds = plan.installSteps.map(s => s.cmd);

        // Ensure we are doing the global npm install
        expect(cmds.some(cmd => cmd.includes('npm install -g firebase-tools'))).toBe(true);

        // Ensure we are caching the emulators
        expect(cmds.some(cmd => cmd.includes('firebase setup:emulators:firestore'))).toBe(true);
        expect(cmds.some(cmd => cmd.includes('firebase setup:emulators:ui'))).toBe(true);
    });
});
