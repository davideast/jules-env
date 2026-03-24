import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';
import { spawn } from 'node:child_process';

async function resolveDarwin(): Promise<ExecutionPlan> {
  const installSteps = [{
    id: 'install-gh',
    label: 'Install GitHub CLI (gh)',
    cmd: 'brew install gh',
    checkCmd: 'brew list --versions gh',
  }];

  let ghPrefix = '';
  try {
    const result = await new Promise<string>((resolve, reject) => {
      const proc = spawn('brew', ['--prefix', 'gh']);
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
      ghPrefix = result;
    }
  } catch (e) {
    // ignore — brew may not be installed
  }

  if (!ghPrefix) {
    ghPrefix = '/usr/local/opt/gh';
  }

  const env = {};
  const paths = [`${ghPrefix}/bin`];

  return ExecutionPlanSchema.parse({ installSteps, env, paths });
}

async function resolveLinux(): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-gh-prereqs',
      label: 'Install prerequisites',
      cmd: '(sudo apt-get update || true) && sudo apt-get install -y apt-transport-https wget',
      checkCmd: 'dpkg -s apt-transport-https && dpkg -s wget',
    },
    {
      id: 'add-gh-signing-key',
      label: 'Add GitHub CLI signing key',
      cmd: 'sudo mkdir -p -m 755 /etc/apt/keyrings && wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null && sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg',
      checkCmd: 'test -f /etc/apt/keyrings/githubcli-archive-keyring.gpg',
    },
    {
      id: 'add-gh-repo',
      label: 'Add GitHub CLI repository',
      cmd: 'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null',
      checkCmd: 'test -f /etc/apt/sources.list.d/github-cli.list',
    },
    {
      id: 'install-gh',
      label: 'Install gh',
      cmd: '(sudo apt-get update || true) && sudo apt-get install -y gh',
      checkCmd: 'dpkg -s gh',
    },
  ];

  const env = {};
  const paths: string[] = [];

  return ExecutionPlanSchema.parse({ installSteps, env, paths });
}

export { GhRecipe as recipe };
export const GhRecipe: Recipe = {
  name: 'gh',
  description: 'GitHub CLI',
  verify: 'gh --version',
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
