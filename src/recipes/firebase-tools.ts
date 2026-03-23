import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';

export { firebaseTools as recipe };
export const firebaseTools: Recipe & { verify?: string } = {
  name: 'firebase-tools',
  description: 'Firebase CLI and pre-cached Local Emulator Suite',
  // Hook for the containerized E2E test to verify the CLI works AND the cache exists
  verify: "firebase --version && test -d ~/.cache/firebase/emulators && ls ~/.cache/firebase/emulators | grep firestore",
  resolve: async (ctx: UseContext): Promise<ExecutionPlan> => {
    const installSteps = [
      {
        id: 'install-nodejs',
        label: 'Install Node.js',
        cmd: 'curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs',
        checkCmd: 'command -v npm',
      },
      {
        id: 'install-java',
        label: 'Install Java',
        cmd: '(sudo apt-get update || true) && sudo apt-get install -y openjdk-21-jre-headless',
        checkCmd: 'command -v java',
      },
      {
        id: 'install-firebase-tools',
        label: 'Install Firebase Tools',
        cmd: 'sudo npm install -g firebase-tools',
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
