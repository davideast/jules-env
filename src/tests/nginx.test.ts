import { describe, test, expect } from "bun:test";
import { NginxRecipe } from '../recipes/nginx';
import { UseContextSchema, ExecutionPlanSchema } from '../core/spec';

describe("Integration: Nginx Recipe", () => {
  const context = UseContextSchema.parse({
    runtime: 'nginx',
    dryRun: true,
  });

  test("resolves plan on current platform", async () => {
    const plan = await NginxRecipe.resolve(context);
    expect(plan.installSteps.length).toBeGreaterThan(0);
    for (const step of plan.installSteps) {
      expect(step.id).toBeDefined();
      expect(step.label).toBeDefined();
      expect(step.cmd).toBeDefined();
    }
  });

  test("sets NGINX_CONF_DIR env var", async () => {
    const plan = await NginxRecipe.resolve(context);
    expect(plan.env['NGINX_CONF_DIR']).toBeDefined();
    expect(plan.env['NGINX_CONF_DIR']!.length).toBeGreaterThan(0);
  });

  test("sets NGINX_DOC_ROOT env var", async () => {
    const plan = await NginxRecipe.resolve(context);
    expect(plan.env['NGINX_DOC_ROOT']).toBeDefined();
    expect(plan.env['NGINX_DOC_ROOT']!.length).toBeGreaterThan(0);
  });

  test("sets NGINX_PORT env var", async () => {
    const plan = await NginxRecipe.resolve(context);
    expect(plan.env['NGINX_PORT']).toBeDefined();
  });

  test("paths is empty", async () => {
    const plan = await NginxRecipe.resolve(context);
    expect(plan.paths).toEqual([]);
  });

  test("files is empty", async () => {
    const plan = await NginxRecipe.resolve(context);
    expect(plan.files).toEqual([]);
  });

  test("plan validates against ExecutionPlanSchema", async () => {
    const plan = await NginxRecipe.resolve(context);
    const parsed = ExecutionPlanSchema.parse(plan);
    expect(parsed).toBeDefined();
  });

  test("wait-for-nginx has no checkCmd", async () => {
    const plan = await NginxRecipe.resolve(context);
    const waitStep = plan.installSteps.find(s => s.id === 'wait-for-nginx');
    expect(waitStep).toBeDefined();
    expect(waitStep?.checkCmd).toBeUndefined();
  });

  test("all steps except wait-for-nginx have a checkCmd", async () => {
    const plan = await NginxRecipe.resolve(context);
    for (const step of plan.installSteps) {
      if (step.id === 'wait-for-nginx') continue;
      expect(step.checkCmd).toBeDefined();
      expect(typeof step.checkCmd).toBe('string');
    }
  });

  test("does not set DART_SDK, FLUTTER_ROOT, GEM_HOME, COMPOSER_HOME, MYSQL_HOST", async () => {
    const plan = await NginxRecipe.resolve(context);
    expect(plan.env['DART_SDK']).toBeUndefined();
    expect(plan.env['FLUTTER_ROOT']).toBeUndefined();
    expect(plan.env['GEM_HOME']).toBeUndefined();
    expect(plan.env['COMPOSER_HOME']).toBeUndefined();
    expect(plan.env['MYSQL_HOST']).toBeUndefined();
  });

  if (process.platform === 'darwin') {
    test("macOS: 3 install steps", async () => {
      const plan = await NginxRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(3);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toEqual(['install-nginx', 'start-nginx', 'wait-for-nginx']);
    });

    test("macOS: install uses brew", async () => {
      const plan = await NginxRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'install-nginx');
      expect(step?.cmd).toBe('brew install nginx');
      expect(step?.checkCmd).toBe('brew list --versions nginx');
    });

    test("macOS: start uses brew services", async () => {
      const plan = await NginxRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'start-nginx');
      expect(step?.cmd).toBe('brew services start nginx');
    });

    test("macOS: start checkCmd uses port 8080", async () => {
      const plan = await NginxRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'start-nginx');
      expect(step?.checkCmd).toContain('8080');
    });

    test("macOS: NGINX_PORT is 8080", async () => {
      const plan = await NginxRecipe.resolve(context);
      expect(plan.env['NGINX_PORT']).toBe('8080');
    });

    test("macOS: NGINX_CONF_DIR ends with /etc/nginx", async () => {
      const plan = await NginxRecipe.resolve(context);
      expect(plan.env['NGINX_CONF_DIR']).toMatch(/\/etc\/nginx$/);
    });

    test("macOS: NGINX_DOC_ROOT ends with /var/www", async () => {
      const plan = await NginxRecipe.resolve(context);
      expect(plan.env['NGINX_DOC_ROOT']).toMatch(/\/var\/www$/);
    });
  }

  if (process.platform === 'linux') {
    test("linux: 3 install steps", async () => {
      const plan = await NginxRecipe.resolve(context);
      expect(plan.installSteps.length).toBe(3);
      const stepIds = plan.installSteps.map(s => s.id);
      expect(stepIds).toEqual(['install-nginx', 'start-nginx', 'wait-for-nginx']);
    });

    test("linux: install uses apt-get", async () => {
      const plan = await NginxRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'install-nginx');
      expect(step?.cmd).toContain('apt-get install -y nginx');
      expect(step?.checkCmd).toBe('dpkg -s nginx');
    });

    test("linux: start cmd contains systemctl and sudo nginx fallback", async () => {
      const plan = await NginxRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'start-nginx');
      expect(step?.cmd).toContain('systemctl');
      expect(step?.cmd).toContain('sudo nginx');
    });

    test("linux: start checkCmd uses port 80", async () => {
      const plan = await NginxRecipe.resolve(context);
      const step = plan.installSteps.find(s => s.id === 'start-nginx');
      expect(step?.checkCmd).toContain('localhost:80');
    });

    test("linux: NGINX_PORT is 80", async () => {
      const plan = await NginxRecipe.resolve(context);
      expect(plan.env['NGINX_PORT']).toBe('80');
    });

    test("linux: NGINX_CONF_DIR is /etc/nginx", async () => {
      const plan = await NginxRecipe.resolve(context);
      expect(plan.env['NGINX_CONF_DIR']).toBe('/etc/nginx');
    });

    test("linux: NGINX_DOC_ROOT is /var/www/html", async () => {
      const plan = await NginxRecipe.resolve(context);
      expect(plan.env['NGINX_DOC_ROOT']).toBe('/var/www/html');
    });
  }
});
