import type { Recipe, UseContext } from './spec';
import { DataRecipeSchema } from './spec';

function substituteVars(str: string, vars: Record<string, string>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
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

      return {
        installSteps,
        env: parsed.env,
        paths: parsed.paths,
        files: parsed.files,
      };
    },
  };
}
