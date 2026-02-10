import { describe, test, expect } from "bun:test";
import { PhpFpmRecipe } from '../recipes/php-fpm';
import { UseContextSchema, ExecutionPlanSchema } from '../core/spec';

describe("Integration: PHP-FPM Recipe", () => {
  const context = UseContextSchema.parse({
    runtime: 'php-fpm',
    dryRun: true,
  });

  test("resolves plan on current platform", async () => {
    const plan = await PhpFpmRecipe.resolve(context);
    expect(plan.installSteps.length).toBeGreaterThan(0);
    for (const step of plan.installSteps) {
      expect(step.id).toBeDefined();
      expect(step.label).toBeDefined();
      expect(step.cmd).toBeDefined();
    }
  });

  test("declares php dependency", () => {
    expect(PhpFpmRecipe.depends).toEqual(['php']);
  });

  test("sets PHP_FPM_LISTEN env var", async () => {
    const plan = await PhpFpmRecipe.resolve(context);
    expect(plan.env['PHP_FPM_LISTEN']).toBeDefined();
    expect(plan.env['PHP_FPM_LISTEN']!.length).toBeGreaterThan(0);
  });

  test("paths is empty", async () => {
    const plan = await PhpFpmRecipe.resolve(context);
    expect(plan.paths).toEqual([]);
  });

  test("files is empty", async () => {
    const plan = await PhpFpmRecipe.resolve(context);
    expect(plan.files).toEqual([]);
  });

  test("plan validates against ExecutionPlanSchema", async () => {
    const plan = await PhpFpmRecipe.resolve(context);
    const parsed = ExecutionPlanSchema.parse(plan);
    expect(parsed).toBeDefined();
  });

  test("wait-for-php-fpm has no checkCmd", async () => {
    const plan = await PhpFpmRecipe.resolve(context);
    const waitStep = plan.installSteps.find(s => s.id === 'wait-for-php-fpm');
    expect(waitStep).toBeDefined();
    expect(waitStep?.checkCmd).toBeUndefined();
  });

  test("all steps except wait-for-php-fpm have a checkCmd", async () => {
    const plan = await PhpFpmRecipe.resolve(context);
    for (const step of plan.installSteps) {
      if (step.id === 'wait-for-php-fpm') continue;
      expect(step.checkCmd).toBeDefined();
      expect(typeof step.checkCmd).toBe('string');
    }
  });

  test("does not set DART_SDK, FLUTTER_ROOT, GEM_HOME, MYSQL_HOST, NGINX_PORT", async () => {
    const plan = await PhpFpmRecipe.resolve(context);
    expect(plan.env['DART_SDK']).toBeUndefined();
    expect(plan.env['FLUTTER_ROOT']).toBeUndefined();
    expect(plan.env['GEM_HOME']).toBeUndefined();
    expect(plan.env['MYSQL_HOST']).toBeUndefined();
    expect(plan.env['NGINX_PORT']).toBeUndefined();
  });

  if (process.platform === 'darwin') {
    test("macOS: 2 install steps", async () => {
      const plan = await PhpFpmRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(2);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toEqual(['start-php-fpm', 'wait-for-php-fpm']);
    });

    test("macOS: no install-php-fpm step (brew php includes FPM)", async () => {
      const plan = await PhpFpmRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'install-php-fpm');
      expect(step).toBeUndefined();
    });

    test("macOS: start uses brew services", async () => {
      const plan = await PhpFpmRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'start-php-fpm');
      expect(step?.cmd).toBe('brew services start php');
    });

    test("macOS: start checkCmd checks port 9000", async () => {
      const plan = await PhpFpmRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'start-php-fpm');
      expect(step?.checkCmd).toContain('9000');
    });

    test("macOS: PHP_FPM_LISTEN is 127.0.0.1:9000", async () => {
      const plan = await PhpFpmRecipe.resolve(context);
      expect(plan.env['PHP_FPM_LISTEN']).toBe('127.0.0.1:9000');
    });

    test("macOS: no setup-fpm-socket step", async () => {
      const plan = await PhpFpmRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'setup-fpm-socket');
      expect(step).toBeUndefined();
    });
  }

  if (process.platform === 'linux') {
    test("linux: 4 install steps", async () => {
      const plan = await PhpFpmRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(4);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toEqual(['install-php-fpm', 'start-php-fpm', 'wait-for-php-fpm', 'setup-fpm-socket']);
    });

    test("linux: install uses apt-get", async () => {
      const plan = await PhpFpmRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'install-php-fpm');
      expect(step?.cmd).toContain('apt-get install -y php-fpm');
    });

    test("linux: start cmd contains systemctl and daemonize fallback", async () => {
      const plan = await PhpFpmRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'start-php-fpm');
      expect(step?.cmd).toContain('systemctl');
      expect(step?.cmd).toContain('daemonize');
      expect(step?.cmd).toContain('mkdir -p /run/php');
    });

    test("linux: start checkCmd checks for socket", async () => {
      const plan = await PhpFpmRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'start-php-fpm');
      expect(step?.checkCmd).toContain('fpm.sock');
    });

    test("linux: setup-fpm-socket creates versionless symlink", async () => {
      const plan = await PhpFpmRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'setup-fpm-socket');
      expect(step?.cmd).toContain('ln -sf');
      expect(step?.cmd).toContain('php-fpm.sock');
    });

    test("linux: PHP_FPM_LISTEN is unix socket path", async () => {
      const plan = await PhpFpmRecipe.resolve(context);
      expect(plan.env['PHP_FPM_LISTEN']).toBe('unix:/run/php/php-fpm.sock');
    });
  }
});
