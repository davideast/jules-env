import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';
import { spawnSync } from 'node:child_process';

async function resolveDarwin(): Promise<ExecutionPlan> {
  const installSteps = [{
    id: 'install-dotnet-sdk',
    label: 'Install .NET SDK',
    cmd: 'brew install dotnet-sdk',
    checkCmd: 'brew list --versions dotnet-sdk',
  }];

  let dotnetPrefix = '';
  try {
    const result = spawnSync('brew', ['--prefix', 'dotnet-sdk'], { encoding: 'utf-8' });
    if (result.status === 0) {
      dotnetPrefix = result.stdout.trim();
    }
  } catch (e) {
    // ignore — brew may not be installed
  }

  if (!dotnetPrefix) {
    dotnetPrefix = '/usr/local/opt/dotnet-sdk';
  }

  const env = {
    DOTNET_ROOT: `${dotnetPrefix}/libexec`,
    DOTNET_CLI_TELEMETRY_OPTOUT: '1',
  };

  const paths = [
    `${dotnetPrefix}/bin`,
    '$HOME/.dotnet/tools',
  ];

  return ExecutionPlanSchema.parse({ installSteps, env, paths });
}

async function resolveLinux(): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-dotnet-prereqs',
      label: 'Install prerequisites',
      cmd: '(sudo apt-get update || true) && sudo apt-get install -y apt-transport-https wget',
      checkCmd: 'dpkg -s apt-transport-https && dpkg -s wget',
    },
    {
      id: 'add-microsoft-signing-key',
      label: 'Add Microsoft package signing key',
      cmd: 'wget -qO- https://packages.microsoft.com/keys/microsoft.asc | sudo gpg --dearmor -o /usr/share/keyrings/microsoft.gpg',
      checkCmd: 'test -f /usr/share/keyrings/microsoft.gpg',
    },
    {
      id: 'add-microsoft-repo',
      label: 'Add Microsoft repository',
      cmd: "echo 'deb [signed-by=/usr/share/keyrings/microsoft.gpg arch=amd64] https://packages.microsoft.com/ubuntu/24.04/prod noble main' | sudo tee /etc/apt/sources.list.d/microsoft-prod.list > /dev/null",
      checkCmd: 'test -f /etc/apt/sources.list.d/microsoft-prod.list',
    },
    {
      id: 'install-dotnet-sdk',
      label: 'Install .NET SDK 8.0',
      cmd: '(sudo apt-get update || true) && sudo apt-get install -y dotnet-sdk-8.0',
      checkCmd: 'dpkg -s dotnet-sdk-8.0',
    },
  ];

  const env = {
    DOTNET_ROOT: '/usr/lib/dotnet',
    DOTNET_CLI_TELEMETRY_OPTOUT: '1',
  };

  const paths = [
    '/usr/lib/dotnet',
    '$HOME/.dotnet/tools',
  ];

  return ExecutionPlanSchema.parse({ installSteps, env, paths });
}

export { DotnetRecipe as recipe };
export const DotnetRecipe: Recipe = {
  name: 'dotnet',
  description: '.NET SDK',
  verify: 'dotnet --version',
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
