import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';
import { spawnSync } from 'node:child_process';

async function resolveDarwin(): Promise<ExecutionPlan> {
  const installSteps = [{
    id: 'install-dart',
    label: 'Install Dart SDK',
    cmd: 'brew install dart-sdk',
    checkCmd: 'brew list --versions dart-sdk',
  }];

  let dartPrefix = '';
  try {
    const result = spawnSync('brew', ['--prefix', 'dart-sdk'], { encoding: 'utf-8' });
    if (result.status === 0) {
      dartPrefix = result.stdout.trim();
    }
  } catch (e) {
    // ignore — brew may not be installed
  }

  if (!dartPrefix) {
    dartPrefix = '/usr/local/opt/dart-sdk';
  }

  const env = {
    DART_SDK: `${dartPrefix}/libexec`,
  };

  const paths = [
    `${dartPrefix}/bin`,
  ];

  return ExecutionPlanSchema.parse({ installSteps, env, paths });
}

async function resolveLinux(): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-dart-prereqs',
      label: 'Install prerequisites',
      cmd: 'sudo apt-get update && sudo apt-get install -y apt-transport-https wget',
      checkCmd: 'dpkg -s apt-transport-https && dpkg -s wget',
    },
    {
      id: 'add-dart-signing-key',
      label: 'Add Dart signing key',
      cmd: 'wget -qO- https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/dart.gpg',
      checkCmd: 'test -f /usr/share/keyrings/dart.gpg',
    },
    {
      id: 'add-dart-repo',
      label: 'Add Dart repository',
      cmd: "echo 'deb [signed-by=/usr/share/keyrings/dart.gpg arch=amd64] https://storage.googleapis.com/dart-archive/channels/stable/release/latest/linux/debian stable main' | sudo tee /etc/apt/sources.list.d/dart_stable.list > /dev/null",
      checkCmd: 'test -f /etc/apt/sources.list.d/dart_stable.list',
    },
    {
      id: 'install-dart',
      label: 'Install Dart SDK',
      cmd: 'sudo apt-get update && sudo apt-get install -y dart',
      checkCmd: 'dpkg -s dart',
    },
  ];

  const env = {
    DART_SDK: '/usr/lib/dart',
  };

  const paths = [
    '/usr/lib/dart/bin',
  ];

  return ExecutionPlanSchema.parse({ installSteps, env, paths });
}

export const DartRecipe: Recipe = {
  name: 'dart',
  description: 'Dart SDK',
  resolve: async (ctx: UseContext): Promise<ExecutionPlan> => {
    switch (process.platform) {
      case 'darwin':
        return resolveDarwin();
      case 'linux':
        return resolveLinux();
      default:
        throw new Error(`Unsupported platform: ${process.platform}`);
    }
  },
};
