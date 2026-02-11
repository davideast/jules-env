import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';
import { spawnSync } from 'node:child_process';

async function resolveDarwin(): Promise<ExecutionPlan> {
  const installSteps = [{
    id: 'install-swift',
    label: 'Install Swift',
    cmd: 'brew install swift',
    checkCmd: 'brew list --versions swift',
  }];

  let swiftPrefix = '';
  try {
    const result = spawnSync('brew', ['--prefix', 'swift'], { encoding: 'utf-8' });
    if (result.status === 0) {
      swiftPrefix = result.stdout.trim();
    }
  } catch (e) {
    // ignore — brew may not be installed
  }

  if (!swiftPrefix) {
    swiftPrefix = '/usr/local/opt/swift';
  }

  const env = {
    SWIFT_PATH: `${swiftPrefix}/bin`,
  };

  const paths = [
    `${swiftPrefix}/bin`,
  ];

  return ExecutionPlanSchema.parse({ installSteps, env, paths });
}

async function resolveLinux(): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-swift-prereqs',
      label: 'Install prerequisites',
      cmd: '(sudo apt-get update || true) && sudo apt-get install -y binutils git gnupg2 libc6-dev libcurl4-openssl-dev libedit2 libgcc-13-dev libncurses-dev libpython3-dev libsqlite3-0 libstdc++-13-dev libxml2-dev libz3-dev pkg-config unzip zlib1g-dev',
      checkCmd: 'dpkg -s libcurl4-openssl-dev && dpkg -s libxml2-dev',
    },
    {
      id: 'install-swift-tarball',
      label: 'Install Swift 6.1',
      cmd: 'curl -fsSL https://download.swift.org/swift-6.1-release/ubuntu2404/swift-6.1-RELEASE/swift-6.1-RELEASE-ubuntu24.04.tar.gz | sudo tar xzf - -C /usr/local --strip-components=2',
      checkCmd: 'test -f /usr/local/bin/swift',
    },
  ];

  const env = {
    SWIFT_PATH: '/usr/local/bin',
  };

  const paths = [
    '/usr/local/bin',
  ];

  return ExecutionPlanSchema.parse({ installSteps, env, paths });
}

export const SwiftRecipe: Recipe = {
  name: 'swift',
  description: 'Swift Programming Language',
  verify: 'swift --version',
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

export { SwiftRecipe as recipe };
