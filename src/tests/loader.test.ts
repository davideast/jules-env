import { describe, test, expect } from "bun:test";
import { loadDataRecipe } from '../core/loader';
import { ZodError } from 'zod';

const validData = {
  name: "test-recipe",
  description: "A test recipe",
  installSteps: [
    {
      id: "step-1",
      label: "First step",
      cmd: "echo hello",
      checkCmd: "which echo",
    },
    {
      id: "step-2",
      label: "Second step",
      cmd: "echo world",
    },
  ],
  env: { FOO: "bar" },
  paths: ["/usr/local/bin"],
  files: [{ path: "/tmp/test.txt", content: "hello" }],
};

describe("loadDataRecipe", () => {
  test("returns a Recipe with correct name and description", () => {
    const recipe = loadDataRecipe(validData);
    expect(recipe.name).toBe("test-recipe");
    expect(recipe.description).toBe("A test recipe");
  });

  test("resolve() returns matching ExecutionPlan", async () => {
    const recipe = loadDataRecipe(validData);
    const plan = await recipe.resolve({ runtime: "test", version: "latest", dryRun: false, options: {} });

    expect(plan.installSteps).toHaveLength(2);
    expect(plan.installSteps[0]!.id).toBe("step-1");
    expect(plan.installSteps[0]!.cmd).toBe("echo hello");
    expect(plan.installSteps[0]!.checkCmd).toBe("which echo");
    expect(plan.installSteps[1]!.id).toBe("step-2");
    expect(plan.installSteps[1]!.checkCmd).toBeUndefined();

    expect(plan.env).toEqual({ FOO: "bar" });
    expect(plan.paths).toEqual(["/usr/local/bin"]);
    expect(plan.files).toEqual([{ path: "/tmp/test.txt", content: "hello" }]);
  });

  test("applies defaults for optional fields", async () => {
    const minimal = {
      name: "minimal",
      description: "Minimal recipe",
      installSteps: [{ id: "s1", label: "Step", cmd: "echo ok" }],
    };
    const recipe = loadDataRecipe(minimal);
    const plan = await recipe.resolve({ runtime: "minimal", version: "latest", dryRun: false, options: {} });

    expect(plan.env).toEqual({});
    expect(plan.paths).toEqual([]);
    expect(plan.files).toEqual([]);
  });

  test("substitutes {{preset}} with ctx.preset", async () => {
    const data = {
      name: "tmpl",
      description: "Template test",
      defaultPreset: "default-model",
      installSteps: [
        {
          id: "pull-{{preset}}",
          label: "Pull {{preset}}",
          cmd: "tool pull {{preset}}",
          checkCmd: "tool list | grep {{preset}}",
        },
      ],
    };
    const recipe = loadDataRecipe(data);
    const plan = await recipe.resolve({ runtime: "tmpl", version: "latest", dryRun: false, options: {}, preset: "custom-model" });

    expect(plan.installSteps[0]!.id).toBe("pull-custom-model");
    expect(plan.installSteps[0]!.label).toBe("Pull custom-model");
    expect(plan.installSteps[0]!.cmd).toBe("tool pull custom-model");
    expect(plan.installSteps[0]!.checkCmd).toBe("tool list | grep custom-model");
  });

  test("falls back to defaultPreset when no preset in context", async () => {
    const data = {
      name: "tmpl",
      description: "Template test",
      defaultPreset: "fallback-model",
      installSteps: [
        {
          id: "pull",
          label: "Pull {{preset}}",
          cmd: "tool pull {{preset}}",
        },
      ],
    };
    const recipe = loadDataRecipe(data);
    const plan = await recipe.resolve({ runtime: "tmpl", version: "latest", dryRun: false, options: {} });

    expect(plan.installSteps[0]!.cmd).toBe("tool pull fallback-model");
    expect(plan.installSteps[0]!.label).toBe("Pull fallback-model");
  });

  test("throws when {{preset}} is used but no preset provided", async () => {
    const data = {
      name: "tmpl",
      description: "Template test",
      installSteps: [
        {
          id: "pull",
          label: "Pull {{preset}}",
          cmd: "tool pull {{preset}}",
        },
      ],
    };
    const recipe = loadDataRecipe(data);
    expect(recipe.resolve({ runtime: "tmpl", version: "latest", dryRun: false, options: {} }))
      .rejects.toThrow("Missing required variable: {{preset}}");
  });

  test("throws ZodError for missing name", () => {
    const bad = { description: "no name", installSteps: [] };
    expect(() => loadDataRecipe(bad)).toThrow(ZodError);
  });

  test("throws ZodError for bad installSteps", () => {
    const bad = {
      name: "bad",
      description: "bad steps",
      installSteps: [{ id: "s1" }], // missing label and cmd
    };
    expect(() => loadDataRecipe(bad)).toThrow(ZodError);
  });
});
