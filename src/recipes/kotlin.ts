import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';
import { spawnSync } from 'node:child_process';

async function resolveDarwin(): Promise<ExecutionPlan> {
  const installSteps = [{
    id: 'install-kotlin',
    label: 'Install Kotlin',
    cmd: 'brew install kotlin',
    checkCmd: 'brew list --versions kotlin',
  }];

  let kotlinPrefix = '';
  try {
    const result = spawnSync('brew', ['--prefix', 'kotlin'], { encoding: 'utf-8' });
    if (result.status === 0) {
      kotlinPrefix = result.stdout.trim();
    }
  } catch (e) {
    // ignore — brew may not be installed
  }

  if (!kotlinPrefix) {
    kotlinPrefix = '/usr/local/opt/kotlin';
  }

  const env = {
    KOTLIN_HOME: `${kotlinPrefix}/libexec`,
  };

  const paths = [
    `${kotlinPrefix}/bin`,
  ];

  return ExecutionPlanSchema.parse({ installSteps, env, paths });
}

async function resolveLinux(): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-kotlin-prereqs',
      label: 'Install prerequisites',
      cmd: '(sudo apt-get update || true) && sudo apt-get install -y unzip zip openjdk-21-jre',
      checkCmd: 'dpkg -s unzip && dpkg -s zip && command -v java',
    },
    {
      id: 'install-kotlin-compiler',
      label: 'Install Kotlin Compiler',
      cmd: 'curl -fsSL https://github.com/JetBrains/kotlin/releases/download/v2.1.0/kotlin-compiler-2.1.0.zip -o /tmp/kotlin.zip && sudo unzip -o -d /usr/local /tmp/kotlin.zip && rm /tmp/kotlin.zip',
      checkCmd: 'test -f /usr/local/kotlinc/bin/kotlin',
    },
  ];

  const env = {
    KOTLIN_HOME: '/usr/local/kotlinc',
  };

  const paths = [
    '/usr/local/kotlinc/bin',
  ];

  return ExecutionPlanSchema.parse({ installSteps, env, paths });
}

export { KotlinRecipe as recipe };
export const KotlinRecipe: Recipe = {
  name: 'kotlin',
  description: 'Kotlin programming language',
  verify: 'kotlin -version',
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
