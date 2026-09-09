import type { Recipe, UseContext } from './spec';
import { DataRecipeSchema } from './spec';

/**
 * The only variable a data recipe may interpolate. Anything else in `{{...}}`
 * belongs to whatever tool the recipe is writing a config for (nginx, Helm,
 * Handlebars) and is passed through untouched.
 */
const SUPPORTED_VARS = ['preset'];

function substituteVars(str: string, vars: Record<string, string>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (!SUPPORTED_VARS.includes(key)) {
      return match;
    }
    const val = vars[key];
    if (val === undefined) {
      throw new Error(`Missing required variable: {{${key}}}. Pass --preset to provide a value.`);
    }
    return val;
  });
}

export function loadDataRecipe(data: unknown): Recipe {
  const parsed = DataRecipeSchema.parse(data);
  return {
    name: parsed.name,
    description: parsed.description,
    verify: parsed.verify,
    resolve: async (ctx: UseContext) => {
      const vars: Record<string, string> = {};
      const preset = ctx.preset ?? parsed.defaultPreset;
      if (preset) {
        vars['preset'] = preset;
      }

      const installSteps = parsed.installSteps.map((step) => ({
        id: substituteVars(step.id, vars),
        label: substituteVars(step.label, vars),
        cmd: substituteVars(step.cmd, vars),
        ...(step.checkCmd ? { checkCmd: substituteVars(step.checkCmd, vars) } : {}),
      }));

      const env = Object.fromEntries(
        Object.entries(parsed.env).map(([key, val]) => [key, substituteVars(val, vars)]),
      );

      const paths = parsed.paths.map((p) => substituteVars(p, vars));

      const files = parsed.files.map((file) => ({
        path: substituteVars(file.path, vars),
        content: substituteVars(file.content, vars),
      }));

      return {
        installSteps,
        env,
        paths,
        files,
      };
    },
  };
}
