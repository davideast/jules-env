import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

function randomKey(): string {
  return randomBytes(32).toString('hex');
}

async function resolveDarwin(ctx: UseContext): Promise<ExecutionPlan> {
  const dbName = ctx.preset || 'wordpress';

  let brewPrefix = '';
  try {
    const result = spawnSync('brew', ['--prefix'], { encoding: 'utf-8' });
    if (result.status === 0) {
      brewPrefix = result.stdout.trim();
    }
  } catch (e) {
    // ignore
  }
  if (!brewPrefix) {
    brewPrefix = '/usr/local';
  }

  const confDir = `${brewPrefix}/etc/nginx`;
  const docRoot = `${brewPrefix}/var/www`;
  const port = '8080';
  const fpmListen = '127.0.0.1:9000';

  const installSteps = [
    {
      id: 'setup-wp-database',
      label: `Create WordPress database '${dbName}'`,
      cmd: `mariadb -u root -e "CREATE DATABASE IF NOT EXISTS \\\`${dbName}\\\`"`,
      checkCmd: `mariadb -u root -e "SHOW DATABASES" | grep -q "^${dbName}$"`,
    },
    {
      id: 'download-wordpress',
      label: 'Download WordPress',
      cmd: `rm -rf ${docRoot}/* && curl -sL https://wordpress.org/latest.tar.gz | tar xzf - -C ${docRoot}/ --strip-components=1`,
      checkCmd: `test -f ${docRoot}/wp-login.php`,
    },
    {
      id: 'configure-wordpress',
      label: 'Configure WordPress',
      cmd: `cat << 'WPEOF' > ${docRoot}/wp-config.php
<?php
define( 'DB_NAME', '${dbName}' );
define( 'DB_USER', 'root' );
define( 'DB_PASSWORD', '' );
define( 'DB_HOST', '127.0.0.1' );
define( 'DB_CHARSET', 'utf8mb4' );
define( 'DB_COLLATE', '' );

define( 'AUTH_KEY',         '${randomKey()}' );
define( 'SECURE_AUTH_KEY',  '${randomKey()}' );
define( 'LOGGED_IN_KEY',    '${randomKey()}' );
define( 'NONCE_KEY',        '${randomKey()}' );
define( 'AUTH_SALT',        '${randomKey()}' );
define( 'SECURE_AUTH_SALT', '${randomKey()}' );
define( 'LOGGED_IN_SALT',   '${randomKey()}' );
define( 'NONCE_SALT',       '${randomKey()}' );

$table_prefix = 'wp_';

define( 'WP_DEBUG', false );

if ( ! defined( 'ABSPATH' ) ) {
    define( 'ABSPATH', __DIR__ . '/' );
}

require_once ABSPATH . 'wp-settings.php';
WPEOF`,
      checkCmd: `test -f ${docRoot}/wp-config.php`,
    },
    {
      id: 'configure-nginx-wp',
      label: 'Configure Nginx for WordPress',
      cmd: `mkdir -p ${confDir}/servers
cat << 'NGINXEOF' > ${confDir}/servers/wordpress.conf
server {
    listen ${port} default_server;
    listen [::]:${port} default_server;
    root ${docRoot};
    index index.php index.html;

    location / {
        try_files $uri $uri/ /index.php?$args;
    }

    location ~ \\.php$ {
        include fastcgi_params;
        fastcgi_pass ${fpmListen};
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_index index.php;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires max;
        log_not_found off;
    }
}
NGINXEOF
cat << 'MAINEOF' > ${confDir}/nginx.conf
worker_processes 1;

events {
    worker_connections 1024;
}

http {
    include mime.types;
    default_type application/octet-stream;
    sendfile on;
    keepalive_timeout 65;
    include servers/*;
}
MAINEOF`,
      checkCmd: `test -f ${confDir}/servers/wordpress.conf`,
    },
    {
      id: 'reload-nginx',
      label: 'Reload Nginx',
      cmd: 'brew services restart nginx',
    },
    {
      id: 'wait-for-wordpress',
      label: 'Wait for WordPress to be ready',
      cmd: `for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sfL http://localhost:${port}/ 2>/dev/null | grep -qi wordpress; then
    exit 0
  fi
  sleep 1
done
echo "WordPress did not respond"
exit 1`,
    },
  ];

  const env = {
    WORDPRESS_URL: `http://localhost:${port}`,
  };

  return ExecutionPlanSchema.parse({ installSteps, env, paths: [] });
}

async function resolveLinux(ctx: UseContext): Promise<ExecutionPlan> {
  const dbName = ctx.preset || 'wordpress';
  const confDir = '/etc/nginx';
  const docRoot = '/var/www/html';
  const port = '80';
  const fpmListen = 'unix:/run/php/php-fpm.sock';

  const installSteps = [
    {
      id: 'install-wp-extensions',
      label: 'Install WordPress PHP extensions',
      cmd: '(sudo apt-get update || true) && sudo apt-get install -y php-mysql php-gd php-intl php-curl',
      checkCmd: 'php -m | grep -qi mysqli',
    },
    {
      id: 'restart-php-fpm',
      label: 'Restart PHP-FPM to load new extensions',
      cmd: `if command -v systemctl >/dev/null 2>&1 && \\
   systemctl is-system-running 2>/dev/null | grep -qE "running|degraded"; then \\
  SVC=$(systemctl list-unit-files 'php*-fpm*' --no-legend | awk '{print $1}' | head -1); \\
  sudo systemctl restart "$SVC"; \\
else \\
  sudo pkill php-fpm || true; sleep 1; \\
  FPM=$(find /usr/sbin -name 'php-fpm[0-9]*' -type f | head -1); \\
  sudo "$FPM" --daemonize; \\
fi
for i in 1 2 3 4 5 6 7 8 9 10; do
  if sudo find /run/php -type s -name 'php*-fpm.sock' | grep -q .; then
    break
  fi
  sleep 1
done
SOCKET=$(sudo find /run/php -type s -name 'php*-fpm.sock' | head -n 1)
sudo ln -sf "$SOCKET" /run/php/php-fpm.sock`,
    },
    {
      id: 'setup-wp-database',
      label: `Create WordPress database '${dbName}' and user`,
      cmd: `mariadb -e "CREATE DATABASE IF NOT EXISTS \\\`${dbName}\\\`; CREATE USER IF NOT EXISTS 'wordpress'@'localhost' IDENTIFIED BY 'wordpress'; GRANT ALL PRIVILEGES ON \\\`${dbName}\\\`.* TO 'wordpress'@'localhost'; FLUSH PRIVILEGES;"`,
      checkCmd: `mariadb -e "SHOW DATABASES" | grep -q "^${dbName}$"`,
    },
    {
      id: 'download-wordpress',
      label: 'Download WordPress',
      cmd: `sudo rm -rf ${docRoot}/* && curl -sL https://wordpress.org/latest.tar.gz | sudo tar xzf - -C ${docRoot}/ --strip-components=1`,
      checkCmd: `test -f ${docRoot}/wp-login.php`,
    },
    {
      id: 'configure-wordpress',
      label: 'Configure WordPress',
      cmd: `cat << 'WPEOF' | sudo tee ${docRoot}/wp-config.php > /dev/null
<?php
define( 'DB_NAME', '${dbName}' );
define( 'DB_USER', 'wordpress' );
define( 'DB_PASSWORD', 'wordpress' );
define( 'DB_HOST', 'localhost' );
define( 'DB_CHARSET', 'utf8mb4' );
define( 'DB_COLLATE', '' );

define( 'AUTH_KEY',         '${randomKey()}' );
define( 'SECURE_AUTH_KEY',  '${randomKey()}' );
define( 'LOGGED_IN_KEY',    '${randomKey()}' );
define( 'NONCE_KEY',        '${randomKey()}' );
define( 'AUTH_SALT',        '${randomKey()}' );
define( 'SECURE_AUTH_SALT', '${randomKey()}' );
define( 'LOGGED_IN_SALT',   '${randomKey()}' );
define( 'NONCE_SALT',       '${randomKey()}' );

$table_prefix = 'wp_';

define( 'WP_DEBUG', false );

if ( ! defined( 'ABSPATH' ) ) {
    define( 'ABSPATH', __DIR__ . '/' );
}

require_once ABSPATH . 'wp-settings.php';
WPEOF`,
      checkCmd: `test -f ${docRoot}/wp-config.php`,
    },
    {
      id: 'set-wp-ownership',
      label: 'Set WordPress file ownership',
      cmd: `sudo chown -R www-data:www-data ${docRoot}`,
      checkCmd: `test "$(stat -c '%U' ${docRoot}/wp-login.php 2>/dev/null)" = "www-data"`,
    },
    {
      id: 'configure-nginx-wp',
      label: 'Configure Nginx for WordPress',
      cmd: `cat << 'NGINXEOF' | sudo tee ${confDir}/sites-available/wordpress > /dev/null
server {
    listen ${port} default_server;
    listen [::]:${port} default_server;
    root ${docRoot};
    index index.php index.html;

    location / {
        try_files $uri $uri/ /index.php?$args;
    }

    location ~ \\.php$ {
        include fastcgi_params;
        fastcgi_pass ${fpmListen};
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_index index.php;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires max;
        log_not_found off;
    }
}
NGINXEOF
sudo ln -sf ${confDir}/sites-available/wordpress ${confDir}/sites-enabled/wordpress
sudo rm -f ${confDir}/sites-enabled/default`,
      checkCmd: `test -f ${confDir}/sites-available/wordpress`,
    },
    {
      id: 'reload-nginx',
      label: 'Reload Nginx',
      cmd: `if command -v systemctl >/dev/null 2>&1 && \\
   systemctl is-system-running 2>/dev/null | grep -qE "running|degraded"; then \\
  sudo systemctl reload nginx; \\
else \\
  sudo nginx -s reload; \\
fi`,
    },
    {
      id: 'wait-for-wordpress',
      label: 'Wait for WordPress to be ready',
      cmd: `for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sfL http://localhost:${port}/ 2>/dev/null | grep -qi wordpress; then
    exit 0
  fi
  sleep 1
done
echo "WordPress did not respond"
exit 1`,
    },
  ];

  const env = {
    WORDPRESS_URL: `http://localhost:${port}`,
  };

  return ExecutionPlanSchema.parse({ installSteps, env, paths: [] });
}

export const WordPressRecipe: Recipe = {
  name: 'wordpress',
  description: 'WordPress CMS',
  depends: ['nginx', 'php-fpm', 'mysql'],
  resolve: async (ctx: UseContext): Promise<ExecutionPlan> => {
    switch (process.platform) {
      case 'darwin':
        return resolveDarwin(ctx);
      case 'linux':
        return resolveLinux(ctx);
      default:
        throw new Error(`Unsupported platform: ${process.platform}`);
    }
  },
};
