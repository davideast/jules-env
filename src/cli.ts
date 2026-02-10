import { Command } from 'commander';
import { UseContextSchema } from './core/spec';
import { executePlan } from './core/executor';
import { resolveDependencies, CircularDependencyError, MissingDependencyError } from './core/resolver';
import type { Recipe } from './core/spec';
import { DartRecipe } from './recipes/dart';
import { FlutterRecipe } from './recipes/flutter';
import { RubyRecipe } from './recipes/ruby';
import { PhpRecipe } from './recipes/php';
import { PhpSqliteRecipe } from './recipes/php-sqlite';
import { MysqlRecipe } from './recipes/mysql';
import { LaravelRecipe } from './recipes/laravel';
import { loadDataRecipe } from './core/loader';
import ollamaData from './recipes/ollama.json';
import { z } from 'zod';
import pkg from '../package.json';

const program = new Command();

// Registry of recipes (simple map for now)
const recipes: Record<string, Recipe> = {
  dart: DartRecipe,
  flutter: FlutterRecipe,
  ruby: RubyRecipe,
  php: PhpRecipe,
  'php-sqlite': PhpSqliteRecipe,
  mysql: MysqlRecipe,
  laravel: LaravelRecipe,
  ollama: loadDataRecipe(ollamaData),
};

program
  .name('jules-env')
  .description('Configure ephemeral development environments')
  .version(pkg.version);

program
  .command('use <runtime>')
  .description('Setup a runtime environment')
  .option('--version <v>', 'Version to install', 'latest')
  .option('--dry-run', 'Simulate execution', false)
  .option('--preset <p>', 'Configuration preset')
  .action(async (runtime, options) => {
    try {
      // 1. Parse Context (for the main target)
      const context = UseContextSchema.parse({
        runtime,
        version: options.version,
        preset: options.preset,
        dryRun: options.dryRun,
      });

      // 2. Resolve Dependencies
      const order = resolveDependencies(runtime, recipes);
      if (order.length > 1) {
        console.log(`[jules-env] Resolving dependencies: ${order.join(' -> ')}`);
      }

      // 3. Execute Chain
      for (const recipeName of order) {
        const recipe = recipes[recipeName]!;

        // Dependencies get a neutral context (no preset/version)
        // Only the target runtime gets the user-specified version/preset
        const depContext = recipeName === runtime
          ? context
          : UseContextSchema.parse({ runtime: recipeName, dryRun: context.dryRun });

        console.log(`[jules-env] Resolving plan for ${recipeName}...`);
        const plan = await recipe.resolve(depContext);
        await executePlan(plan, context.dryRun, recipeName);
      }

    } catch (err) {
      if (err instanceof z.ZodError) {
        console.error("Validation Error:", err.errors);
      } else if (err instanceof CircularDependencyError || err instanceof MissingDependencyError) {
        console.error("Dependency Error:", err.message);
      } else {
        console.error("Error:", err);
      }
      process.exit(1);
    }
  });

program.parse();
