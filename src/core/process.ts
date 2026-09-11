export async function execAsync(cmd: string, args: string[]): Promise<{ status: number; stdout: string }> {
  if (typeof Bun !== 'undefined') {
    const proc = Bun.spawn([cmd, ...args], { stdout: 'pipe' });
    const stdout = await new Response(proc.stdout).text();
    const status = await proc.exited;
    return { status, stdout };
  } else {
    const { spawn } = await import('node:child_process');
    return new Promise<{ status: number; stdout: string }>((resolve) => {
      const child = spawn(cmd, args);
      let stdout = '';
      child.stdout?.on('data', (data) => {
        stdout += data;
      });
      child.on('close', (status) => {
        resolve({ status: status ?? 1, stdout });
      });
      child.on('error', () => {
        resolve({ status: 1, stdout });
      });
    });
  }
}
