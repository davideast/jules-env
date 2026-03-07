import { executePlan } from '../core/executor';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync, unlinkSync, readFileSync, mkdirSync } from 'node:fs';

async function test() {
  const julesDir = join(homedir(), '.jules');
  const stateFile = join(julesDir, 'shellenv');

  // Cleanup
  if (existsSync(stateFile)) unlinkSync(stateFile);
  if (!existsSync(julesDir)) mkdirSync(julesDir, { recursive: true });

  const plan: any = {
    installSteps: [],
    env: { "TEST_VAR": "TEST_VAL", "ANOTHER": "VALUE" },
    paths: ["/test/path", "/another/path"],
    files: [],
  };

  console.log("Running executePlan...");
  await executePlan(plan, false);

  if (existsSync(stateFile)) {
    const content = readFileSync(stateFile, 'utf-8');
    console.log("Content of shellenv:\n" + content);

    const expectedPath = 'export PATH="/test/path:/another/path:$PATH"\n';
    const expectedVar1 = 'export TEST_VAR="TEST_VAL"\n';
    const expectedVar2 = 'export ANOTHER="VALUE"\n';

    if (content.includes(expectedPath) && content.includes(expectedVar1) && content.includes(expectedVar2)) {
      console.log("SUCCESS: Content matches expected output.");
    } else {
      console.error("FAILURE: Content does not match expected output.");
      process.exit(1);
    }
  } else {
    console.error("FAILURE: shellenv file not created.");
    process.exit(1);
  }
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
