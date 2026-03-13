import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';

export { firebaseTools as recipe };
export const firebaseTools: Recipe = {
  name: 'firebase-tools',
  description: 'Firebase CLI and pre-cached Local Emulator Suite',
  // Node and Java are already assumed on the Jules VM
  depends: [],
  // Hook for the containerized E2E test to verify the CLI works AND the cache exists
  verify: "firebase --version && test -d ~/.cache/firebase/emulators && ls ~/.cache/firebase/emulators | grep -q firestore",
  resolve: async (ctx: UseContext): Promise<ExecutionPlan> => {
    const installSteps = [
      {
        id: 'install-firebase-tools',
        label: 'Install Firebase Tools',
        cmd: 'npm install -g firebase-tools',
        checkCmd: 'firebase --version',
      },
      {
        id: 'setup-emulator-ui',
        label: 'Setup Firebase UI Emulator',
        cmd: 'firebase setup:emulators:ui',
      },
      {
        id: 'setup-emulator-firestore',
        label: 'Setup Firebase Firestore Emulator',
        cmd: 'firebase setup:emulators:firestore',
      },
      {
        id: 'setup-emulator-database',
        label: 'Setup Firebase Database Emulator',
        cmd: 'firebase setup:emulators:database',
      },
      {
        id: 'setup-emulator-pubsub',
        label: 'Setup Firebase PubSub Emulator',
        cmd: 'firebase setup:emulators:pubsub',
      },
      {
        id: 'setup-emulator-storage',
        label: 'Setup Firebase Storage Emulator',
        cmd: 'firebase setup:emulators:storage',
      }
    ];

    return ExecutionPlanSchema.parse({ installSteps, env: {}, paths: [] });
  },
};
