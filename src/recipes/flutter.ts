import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';
import { spawn } from 'node:child_process';

async function resolveDarwin(): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-flutter',
      label: 'Install Flutter SDK',
      cmd: 'brew install --cask flutter',
      checkCmd: 'brew list --cask flutter',
    },
    {
      id: 'precache-web',
      label: 'Precache Flutter web artifacts',
      cmd: 'flutter precache --web',
      checkCmd: 'test -d "$(brew --cask --room 2>/dev/null || echo /usr/local/Caskroom)/flutter"/*/flutter/bin/cache/flutter_web_sdk',
    },
  ];

  let flutterRoot = '';
  try {
    const result = await new Promise<string>((resolve, reject) => {
      const proc = spawn('brew', ['--cask', '--room']);
      let stdout = '';
      proc.stdout.on('data', chunk => stdout += chunk);
      proc.on('close', code => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error('command failed'));
        }
      });
      proc.on('error', reject);
    });
    if (result) {
      const caskroom = result;
      // Find the actual flutter path inside the caskroom
      const ls = await new Promise<string>((resolve, reject) => {
        const proc = spawn('ls', [caskroom + '/flutter']);
        let stdout = '';
        proc.stdout.on('data', chunk => stdout += chunk);
        proc.on('close', code => {
          if (code === 0) {
            resolve(stdout.trim());
          } else {
            reject(new Error('command failed'));
          }
        });
        proc.on('error', reject);
      });
      if (ls) {
        const version = ls.split('\n')[0];
        if (version) {
          flutterRoot = `${caskroom}/flutter/${version}/flutter`;
        }
      }
    }
  } catch (e) {
    // ignore — brew may not be installed
  }

  if (!flutterRoot) {
    flutterRoot = '/usr/local/Caskroom/flutter/latest/flutter';
  }

  // Update precache checkCmd with resolved path
  installSteps[1]!.checkCmd = `test -d ${flutterRoot}/bin/cache/flutter_web_sdk`;

  const env = {
    FLUTTER_ROOT: flutterRoot,
  };

  const paths = [
    `${flutterRoot}/bin`,
  ];

  return ExecutionPlanSchema.parse({ installSteps, env, paths });
}

async function resolveLinux(): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-flutter-prereqs',
      label: 'Install prerequisites',
      cmd: '(sudo apt-get update || true) && sudo apt-get install -y curl git unzip xz-utils',
      checkCmd: 'dpkg -s curl && dpkg -s git && dpkg -s unzip && dpkg -s xz-utils',
    },
    {
      id: 'clone-flutter',
      label: 'Clone Flutter SDK',
      cmd: 'sudo git clone -b stable https://github.com/flutter/flutter.git /usr/local/flutter && sudo chown -R $(id -u):$(id -g) /usr/local/flutter',
      checkCmd: 'test -d /usr/local/flutter',
    },
    {
      id: 'precache-web',
      label: 'Precache Flutter web artifacts',
      cmd: '/usr/local/flutter/bin/flutter precache --web',
      checkCmd: 'test -d /usr/local/flutter/bin/cache/flutter_web_sdk',
    },
  ];

  const env = {
    FLUTTER_ROOT: '/usr/local/flutter',
  };

  const paths = [
    '/usr/local/flutter/bin',
  ];

  return ExecutionPlanSchema.parse({ installSteps, env, paths });
}

export { FlutterRecipe as recipe };
export const FlutterRecipe: Recipe = {
  name: 'flutter',
  description: 'Flutter SDK (web)',
  verify: 'flutter --version',
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
