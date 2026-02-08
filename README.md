# jules-env

Configure ephemeral development environments in one command.

```bash
jules-env use dart
```

That's it. The runtime is installed, environment variables are set, and your shell is configured:

```
✔ brew install dart-sdk
Wrote .jules/shellenv
  export PATH="/opt/homebrew/opt/dart-sdk/bin:$PATH"
  export DART_SDK="/opt/homebrew/opt/dart-sdk/libexec"
```

## Runtime configuration

`jules-env` follows a **recipe → plan → execute** model:

1. **Recipe** — A recipe describes how to install a runtime. It probes the system (e.g., `brew --prefix dart-sdk`) but never modifies it.
2. **Plan** — The recipe produces an execution plan: shell commands to run, environment variables to set, and paths to prepend.
3. **Execute** — The plan runs. Install steps that are already satisfied (checked via an optional `checkCmd`) are skipped. State is persisted to `.jules/shellenv`.

### Data recipes

Recipes can also be defined as JSON files. A data recipe is a static execution plan — no system probing, no dynamic resolution. This makes them easy to generate programmatically (e.g., by an LLM). Data recipes are validated against a Zod schema at load time. See `src/recipes/ollama.json` for an example.

## Shell environment

After execution, `.jules/shellenv` contains the environment your runtime needs:

```bash
export PATH="/opt/homebrew/opt/dart-sdk/bin:$PATH"
export DART_SDK="/opt/homebrew/opt/dart-sdk/libexec"
```

Source it to activate:

```bash
source .jules/shellenv
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

## Available recipes

| Runtime | Recipe | Type | Description |
|---------|--------|------|-------------|
| Dart | `dart` | Code | Installs the Dart SDK (Homebrew on macOS, apt on Linux) |
| Ollama | `ollama` | Data | Installs Ollama with EmbeddingGemma model |

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
