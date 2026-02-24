# jules-env

Configure ephemeral development environments in one command.

```bash
jules-env use dart
```

That's it. The runtime is installed, environment variables are set, and your shell is configured:

```
✔ brew install dart-sdk
Wrote ~/.jules/shellenv
  export PATH="/opt/homebrew/opt/dart-sdk/bin:$PATH"
  export DART_SDK="/opt/homebrew/opt/dart-sdk/libexec"
```

## Runtime configuration

`jules-env` follows a **recipe → plan → execute** model:

1. **Recipe** — A recipe describes how to install a runtime. It probes the system (e.g., `brew --prefix dart-sdk`) but never modifies it.
2. **Plan** — The recipe produces an execution plan: shell commands to run, environment variables to set, and paths to prepend.
3. **Execute** — The plan runs. Install steps that are already satisfied (checked via an optional `checkCmd`) are skipped. State is persisted to `~/.jules/shellenv`.

### Data recipes

Recipes can also be defined as JSON files. A data recipe is a static execution plan — no system probing, no dynamic resolution. This makes them easy to generate programmatically (e.g., by an LLM). Data recipes are validated against a Zod schema at load time. See `src/recipes/ollama.json` for an example.

## Shell environment

After execution, `~/.jules/shellenv` contains the environment your runtime needs:

```bash
export PATH="/opt/homebrew/opt/dart-sdk/bin:$PATH"
export DART_SDK="/opt/homebrew/opt/dart-sdk/libexec"
```

Source it to activate:

```bash
source ~/.jules/shellenv
```

The file is appended to on subsequent runs, so multiple runtimes compose cleanly.

## CLI reference

```
jules-env use <runtime> [options]
```

### Arguments

- `<runtime>` — The runtime environment to setup (e.g., `dart`).

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--version <v>` | Version of the runtime to install | `latest` |
| `--dry-run` | Simulate execution — no changes are made | `false` |
| `--preset <p>` | Apply a configuration preset (if available for the runtime) | — |
| `-h, --help` | Display help | — |

### Dry run

Preview what would happen without touching the system:

```bash
jules-env use dart --dry-run
```

## Runtimes and Tools

Practical guides for setting up common development environments.

### WordPress

Installs a complete WordPress stack including Nginx, PHP-FPM, and MySQL (MariaDB). It configures Nginx to serve WordPress and sets up the database.

```bash
jules-env use wordpress
```

This will:
- Install Nginx, PHP-FPM, and MariaDB if they are not already installed.
- Configure Nginx to serve from a local directory (e.g., `/var/www/html` on Linux or Homebrew prefix on macOS).
- Create a database and user.
- Download and configure WordPress.

### PostgreSQL

Installs and starts PostgreSQL.

```bash
jules-env use postgres
```

You can also specify a preset to automatically create a database:

```bash
jules-env use postgres --preset my_app_db
```

This ensures the service is running and the database exists.

### Laravel

Sets up the Laravel installer globally. Note that this requires PHP, which will be installed automatically as a dependency (along with the SQLite extension).

```bash
jules-env use laravel
```

After this, you can run `laravel new my-project`.

### Ollama

Installs Ollama and pulls a specific model.

```bash
jules-env use ollama --preset llama3
```

This uses a data recipe to install Ollama and pull the `llama3` model.

### General Usage

To use any runtime, simply run:

```bash
jules-env use <runtime>
```

You can combine multiple runtimes by running the command multiple times. They will all contribute to your `~/.jules/shellenv` file.

## Exhaustive list

A complete reference of all available tools and runtimes.

| Runtime | Type | Description | Dependencies |
| :--- | :--- | :--- | :--- |
| `dart` | Code | Dart SDK | - |
| `deno` | Code | Deno runtime | - |
| `dotnet` | Code | .NET SDK | - |
| `flutter` | Code | Flutter SDK (web) | - |
| `gh` | Code | GitHub CLI | - |
| `kotlin` | Code | Kotlin programming language | - |
| `laravel` | Code | Laravel PHP framework installer | `php-sqlite` |
| `mongo` | Code | MongoDB Community Edition | - |
| `mysql` | Code | MySQL compatible relational database (MariaDB) | - |
| `nginx` | Code | Nginx web server | - |
| `ollama` | Data | Ollama with configurable model | - |
| `php` | Code | PHP programming language with Composer | - |
| `php-fpm` | Code | PHP FastCGI Process Manager | `php` |
| `php-sqlite` | Code | PHP SQLite extension | `php` |
| `postgres` | Code | PostgreSQL relational database | - |
| `r-lang` | Code | R programming language | - |
| `redis` | Code | Redis in-memory data structure store | - |
| `ruby` | Code | Ruby programming language | - |
| `swift` | Code | Swift Programming Language | - |
| `wordpress` | Code | WordPress CMS | `nginx`, `php-fpm`, `mysql` |

## Installation

### npm

```bash
npm install jules-env
```

### From source

```bash
git clone <repository_url>
cd jules-env
bun install
bun run build
```

## Development

### Prerequisites

- [Bun](https://bun.sh/)
- [Homebrew](https://brew.sh/) (macOS only, used by Dart recipe)

### Run tests

```bash
bun test
```

### Build

```bash
bun run build          # Build both Node.js bundle and Bun binary
bun run build:node     # Node.js bundle only (dist/cli.mjs)
bun run build:binary   # Standalone Bun binary only (jules-env)
```

### Type check

```bash
bun run typecheck
```

### Prepublish checks

Run the full validation suite before publishing:

```bash
bun run check:all
```

This validates version, runs type checks, tests, builds both targets, and smoke-tests the outputs.
