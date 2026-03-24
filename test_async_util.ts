export async function getCommandOutput(cmd: string, args: string[]): Promise<string> {
  if (typeof Bun !== 'undefined') {
    const proc = Bun.spawn([cmd, ...args], { stdout: 'pipe' });
    const output = await new Response(proc.stdout).text();
    return output.trim();
  } else {
    const { spawn } = await import('node:child_process');
    return new Promise<string>((resolve) => {
      const child = spawn(cmd, args);
      let stdout = '';
      child.stdout?.on('data', (data) => { stdout += data; });
      child.on('close', () => resolve(stdout.trim()));
      child.on('error', () => resolve(''));
    });
  }
}
