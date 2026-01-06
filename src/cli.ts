import { Command } from 'commander';
import { UseContextSchema } from './core/spec';
import { executePlan } from './core/executor';
import { DartRecipe } from './recipes/dart';
import { z } from 'zod';

const program = new Command();

// Registry of recipes (simple map for now)
const recipes: Record<string, any> = {
  dart: DartRecipe,
};

program
  .name('jules-env')
  .description('Configure ephemeral development environments')
  .version('0.0.1');

program
  .command('use <runtime>')
  .description('Setup a runtime environment')
  .option('--version <v>', 'Version to install', 'latest')
  .option('--dry-run', 'Simulate execution', false)
  .option('--preset <p>', 'Configuration preset')
  .action(async (runtime, options) => {
    try {
      // 1. Look up recipe
      const recipe = recipes[runtime];
      if (!recipe) {
        console.error(`Error: Recipe for '${runtime}' not found.`);
        process.exit(1);
      }

      // 2. Parse Context
      const context = UseContextSchema.parse({
        runtime,
        version: options.version,
        preset: options.preset,
        dryRun: options.dryRun,
        // options: ... (passed via remaining args if we supported that)
      });

      console.log(`[jules-env] Resolving plan for ${runtime}...`);

      // 3. Resolve Plan
      const plan = await recipe.resolve(context);

      // 4. Execute Plan
      await executePlan(plan, context.dryRun);

    } catch (err) {
      if (err instanceof z.ZodError) {
        console.error("Validation Error:", err.errors);
      } else {
        console.error("Error:", err);
      }
      process.exit(1);
    }
  });

program.parse();
