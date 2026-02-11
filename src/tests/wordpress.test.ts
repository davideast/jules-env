import { describe, test, expect } from "bun:test";
import { WordPressRecipe } from '../recipes/wordpress';
import { UseContextSchema, ExecutionPlanSchema } from '../core/spec';

describe('WordPressRecipe', () => {
  test('declares depends on nginx, php-fpm, mysql', () => {
    expect(WordPressRecipe.depends).toEqual(['nginx', 'php-fpm', 'mysql']);
  });

  test('resolves plan on current platform', async () => {
    const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
    const plan = await WordPressRecipe.resolve(ctx);
    expect(ExecutionPlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.installSteps.length).toBeGreaterThan(0);
    for (const step of plan.installSteps) {
      expect(step.id).toBeDefined();
      expect(step.label).toBeDefined();
      expect(step.cmd).toBeDefined();
    }
  });

  test('sets WORDPRESS_URL env var', async () => {
    const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
    const plan = await WordPressRecipe.resolve(ctx);
    expect(plan.env).toBeDefined();
    expect(plan.env!['WORDPRESS_URL']).toContain('http://localhost');
  });

  test('paths is empty', async () => {
    const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
    const plan = await WordPressRecipe.resolve(ctx);
    expect(plan.paths).toEqual([]);
  });

  test('does not set unrelated env vars', async () => {
    const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
    const plan = await WordPressRecipe.resolve(ctx);
    const env = plan.env || {};
    expect(env['DART_SDK']).toBeUndefined();
    expect(env['FLUTTER_ROOT']).toBeUndefined();
    expect(env['GEM_HOME']).toBeUndefined();
    expect(env['COMPOSER_HOME']).toBeUndefined();
    expect(env['MYSQL_HOST']).toBeUndefined();
  });

  test("default database name is 'wordpress'", async () => {
    const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
    const plan = await WordPressRecipe.resolve(ctx);
    const step = plan.installSteps.find(s => s.id === 'setup-wp-database');
    expect(step).toBeDefined();
    expect(step!.cmd).toContain('wordpress');
  });

  test('preset overrides database name', async () => {
    const ctx = UseContextSchema.parse({ runtime: 'wordpress', preset: 'myblog' });
    const plan = await WordPressRecipe.resolve(ctx);
    const step = plan.installSteps.find(s => s.id === 'setup-wp-database');
    expect(step).toBeDefined();
    expect(step!.label).toContain("'myblog'");
    expect(step!.cmd).toContain('myblog');
  });

  test('configure-wordpress cmd contains wp-config.php content', async () => {
    const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
    const plan = await WordPressRecipe.resolve(ctx);
    const step = plan.installSteps.find(s => s.id === 'configure-wordpress');
    expect(step).toBeDefined();
    expect(step!.cmd).toContain("define( 'DB_NAME', 'wordpress' )");
    expect(step!.cmd).toContain("define( 'DB_USER',");
    expect(step!.cmd).toContain("define( 'AUTH_KEY',");
    expect(step!.cmd).toContain("$table_prefix = 'wp_';");
    expect(step!.cmd).toContain("require_once ABSPATH . 'wp-settings.php';");
  });

  test('configure-wordpress generates unique auth keys', async () => {
    const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
    const plan = await WordPressRecipe.resolve(ctx);
    const step = plan.installSteps.find(s => s.id === 'configure-wordpress');
    expect(step).toBeDefined();

    // Extract all hex strings that look like keys
    const hexKeys = step!.cmd.match(/'[a-f0-9]{64}'/g);
    expect(hexKeys).not.toBeNull();
    // 8 keys defined in wp-config.php
    expect(hexKeys!.length).toBe(8);

    // Verify uniqueness
    const uniqueKeys = new Set(hexKeys);
    expect(uniqueKeys.size).toBe(8);
  });

  test('configure-nginx-wp cmd contains nginx server block', async () => {
    const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
    const plan = await WordPressRecipe.resolve(ctx);
    const step = plan.installSteps.find(s => s.id === 'configure-nginx-wp');
    expect(step).toBeDefined();
    expect(step!.cmd).toContain('server {');
    expect(step!.cmd).toContain('fastcgi_pass');
    expect(step!.cmd).toContain('index.php');
    expect(step!.cmd).toContain('$uri');
  });

  test('reload-nginx has no checkCmd', async () => {
    const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
    const plan = await WordPressRecipe.resolve(ctx);
    const step = plan.installSteps.find(s => s.id === 'reload-nginx');
    expect(step).toBeDefined();
    expect(step!.checkCmd).toBeUndefined();
  });

  test('download-wordpress uses wordpress.org', async () => {
    const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
    const plan = await WordPressRecipe.resolve(ctx);
    const step = plan.installSteps.find(s => s.id === 'download-wordpress');
    expect(step).toBeDefined();
    expect(step!.cmd).toContain('https://wordpress.org/latest.tar.gz');
    expect(step!.cmd).toContain('--strip-components=1');
  });

  // Platform specific tests
  if (process.platform === 'darwin') {
    test('macOS: 5 steps', async () => {
      const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
      const plan = await WordPressRecipe.resolve(ctx);
      const ids = plan.installSteps.map(s => s.id);
      expect(ids).toEqual([
        'setup-wp-database',
        'download-wordpress',
        'configure-wordpress',
        'configure-nginx-wp',
        'reload-nginx'
      ]);
    });

    test('macOS: WORDPRESS_URL uses port 8080', async () => {
      const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
      const plan = await WordPressRecipe.resolve(ctx);
      expect(plan.env!['WORDPRESS_URL']).toBe('http://localhost:8080');
    });

    test('macOS: database uses root with no password', async () => {
      const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
      const plan = await WordPressRecipe.resolve(ctx);
      const step = plan.installSteps.find(s => s.id === 'configure-wordpress');
      expect(step!.cmd).toContain("define( 'DB_USER', 'root' )");
      expect(step!.cmd).toContain("define( 'DB_PASSWORD', '' )");
    });

    test('macOS: nginx config uses port 8080', async () => {
      const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
      const plan = await WordPressRecipe.resolve(ctx);
      const step = plan.installSteps.find(s => s.id === 'configure-nginx-wp');
      expect(step!.cmd).toContain('listen 8080');
    });

    test('macOS: nginx config goes to servers/ directory', async () => {
      const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
      const plan = await WordPressRecipe.resolve(ctx);
      const step = plan.installSteps.find(s => s.id === 'configure-nginx-wp');
      expect(step!.cmd).toContain('/servers/wordpress.conf');
    });

    test('macOS: overwrites nginx.conf to remove default server', async () => {
      const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
      const plan = await WordPressRecipe.resolve(ctx);
      const step = plan.installSteps.find(s => s.id === 'configure-nginx-wp');
      expect(step!.cmd).toContain('nginx.conf');
      expect(step!.cmd).toContain('include servers/*');
    });

    test('macOS: reload uses brew services', async () => {
      const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
      const plan = await WordPressRecipe.resolve(ctx);
      const step = plan.installSteps.find(s => s.id === 'reload-nginx');
      expect(step!.cmd).toBe('brew services restart nginx');
    });

    test('macOS: fastcgi_pass uses TCP', async () => {
      const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
      const plan = await WordPressRecipe.resolve(ctx);
      const step = plan.installSteps.find(s => s.id === 'configure-nginx-wp');
      expect(step!.cmd).toContain('fastcgi_pass 127.0.0.1:9000');
    });
  }

  if (process.platform === 'linux') {
    test('linux: 8 steps', async () => {
      const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
      const plan = await WordPressRecipe.resolve(ctx);
      const ids = plan.installSteps.map(s => s.id);
      expect(ids).toEqual([
        'install-wp-extensions',
        'restart-php-fpm',
        'setup-wp-database',
        'download-wordpress',
        'configure-wordpress',
        'set-wp-ownership',
        'configure-nginx-wp',
        'reload-nginx'
      ]);
    });

    test('linux: WORDPRESS_URL uses port 80', async () => {
      const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
      const plan = await WordPressRecipe.resolve(ctx);
      expect(plan.env!['WORDPRESS_URL']).toBe('http://localhost:80');
    });

    test('linux: database uses wordpress user with password', async () => {
      const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
      const plan = await WordPressRecipe.resolve(ctx);
      const step = plan.installSteps.find(s => s.id === 'configure-wordpress');
      expect(step!.cmd).toContain("define( 'DB_USER', 'wordpress' )");
      expect(step!.cmd).toContain("define( 'DB_PASSWORD', 'wordpress' )");
    });

    test('linux: setup-wp-database creates user with password auth', async () => {
      const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
      const plan = await WordPressRecipe.resolve(ctx);
      const step = plan.installSteps.find(s => s.id === 'setup-wp-database');
      expect(step!.cmd).toContain("IDENTIFIED BY 'wordpress'");
      expect(step!.cmd).toContain('GRANT ALL PRIVILEGES');
    });

    test('linux: install-wp-extensions installs php-mysql, php-gd, php-intl', async () => {
      const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
      const plan = await WordPressRecipe.resolve(ctx);
      const step = plan.installSteps.find(s => s.id === 'install-wp-extensions');
      expect(step!.cmd).toContain('php-mysql');
      expect(step!.cmd).toContain('php-gd');
      expect(step!.cmd).toContain('php-intl');
      expect(step!.cmd).toContain('php-curl');
    });

    test('linux: restart-php-fpm has checkCmd', async () => {
      const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
      const plan = await WordPressRecipe.resolve(ctx);
      const step = plan.installSteps.find(s => s.id === 'restart-php-fpm');
      expect(step!.checkCmd).toBeDefined();
      expect(step!.checkCmd).toContain('test -S');
    });

    test('linux: restart-php-fpm uses systemd/daemon dual-path with wait loop', async () => {
      const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
      const plan = await WordPressRecipe.resolve(ctx);
      const step = plan.installSteps.find(s => s.id === 'restart-php-fpm');
      expect(step!.cmd).toContain('systemctl');
      expect(step!.cmd).toContain('pkill php-fpm');
      expect(step!.cmd).toContain('sleep 1');
      expect(step!.cmd).toContain('sudo ln -sf');
    });

    test('linux: set-wp-ownership chowns to www-data', async () => {
      const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
      const plan = await WordPressRecipe.resolve(ctx);
      const step = plan.installSteps.find(s => s.id === 'set-wp-ownership');
      expect(step!.cmd).toContain('www-data:www-data');
    });

    test('linux: nginx config goes to sites-available', async () => {
      const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
      const plan = await WordPressRecipe.resolve(ctx);
      const step = plan.installSteps.find(s => s.id === 'configure-nginx-wp');
      expect(step!.cmd).toContain('sites-available/wordpress');
      expect(step!.cmd).toContain('sites-enabled/wordpress');
    });

    test('linux: nginx config removes default site', async () => {
      const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
      const plan = await WordPressRecipe.resolve(ctx);
      const step = plan.installSteps.find(s => s.id === 'configure-nginx-wp');
      expect(step!.cmd).toContain('rm -f');
      expect(step!.cmd).toContain('sites-enabled/default');
    });

    test('linux: fastcgi_pass uses unix socket', async () => {
      const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
      const plan = await WordPressRecipe.resolve(ctx);
      const step = plan.installSteps.find(s => s.id === 'configure-nginx-wp');
      expect(step!.cmd).toContain('fastcgi_pass unix:/run/php/php-fpm.sock');
    });

    test('linux: reload uses systemd/daemon dual-path', async () => {
      const ctx = UseContextSchema.parse({ runtime: 'wordpress' });
      const plan = await WordPressRecipe.resolve(ctx);
      const step = plan.installSteps.find(s => s.id === 'reload-nginx');
      expect(step!.cmd).toContain('systemctl reload nginx');
      expect(step!.cmd).toContain('nginx -s reload');
    });
  }
});
