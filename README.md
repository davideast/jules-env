# jules-env

A CLI tool for managing ephemeral development environments. `jules-env` allows you to configure and switch between different runtime environments seamlessly.

## Features

-   **Ephemeral Environment Management**: Easily setup and tear down development environments.
-   **Runtime Support**: Currently supports the **Dart** runtime.
-   **Dry-Run Mode**: Preview the changes that will be made without executing them.
-   **State Persistence**: Environment state is saved to a `.jules-state` file.

## Prerequisites

-   [Bun](https://bun.sh/)
-   [Homebrew](https://brew.sh/) (Required for the Dart recipe)

## Installation

1.  Clone the repository:
    ```bash
    git clone <repository_url>
    cd jules-env
    ```

2.  Install dependencies:
    ```bash
    bun install
    ```

## Usage

The CLI is executed using `bun`. The main command is `use`.

```bash
bun run src/cli.ts use <runtime> [options]
```

### Arguments

-   `<runtime>`: The name of the runtime environment to setup (e.g., `dart`).

### Options

-   `--version <v>`: Specify the version of the runtime to install. Defaults to `latest`.
-   `--dry-run`: Simulate the execution. No changes will be made to the system.
-   `--preset <p>`: Apply a specific configuration preset (if available for the runtime).
-   `-h, --help`: Display help for command.

## Examples

### 1. Setup Dart Environment (Latest Version)

To setup the latest version of the Dart SDK:

```bash
bun run src/cli.ts use dart
```

This will:
-   Install the Dart SDK using Homebrew (`brew install dart-sdk`).
-   Generate a `.jules-state` file with the necessary environment variables (`DART_SDK`) and `PATH` updates.

### 2. Setup Dart with a Specific Version

To setup a specific version (e.g., 3.2):

```bash
bun run src/cli.ts use dart --version 3.2
```

*(Note: The current Dart recipe uses Homebrew, which typically installs the latest version. The version flag is passed to the context but implementation depends on the recipe.)*

### 3. Dry Run

To see what changes would be made without actually running them:

```bash
bun run src/cli.ts use dart --dry-run
```

This will output the plan and what commands would be executed.

## Environment State

After running the command, a `.jules-state` file is created (or updated) in the current directory. This file contains the environment variables and paths needed for the runtime.

Example `.jules-state` content:
```bash
export DART_SDK="/opt/homebrew/opt/dart-sdk/libexec"
export PATH="/opt/homebrew/opt/dart-sdk/bin:$PATH"
```

You can source this file to activate the environment:
```bash
source .jules-state
```

## Development

To run the integration tests:

```bash
bun test
```
