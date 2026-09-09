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

  test("substitutes {{preset}} in env, paths and files, not just installSteps", async () => {
    const recipe = loadDataRecipe({
      name: "tmpl-all",
      description: "templates outside installSteps",
      defaultPreset: "v1",
      installSteps: [{ id: "s", label: "Install {{preset}}", cmd: "tool get {{preset}}" }],
      env: { TOOL_HOME: "/opt/tool/{{preset}}" },
      paths: ["/opt/tool/{{preset}}/bin"],
      files: [{ path: "/etc/tool/{{preset}}.conf", content: "version={{preset}}" }],
    });
    const plan = await recipe.resolve({ runtime: "tmpl-all", version: "latest", dryRun: false, options: {} });

    expect(plan.env['TOOL_HOME']).toBe("/opt/tool/v1");
    expect(plan.paths[0]).toBe("/opt/tool/v1/bin");
    expect(plan.files[0]!.path).toBe("/etc/tool/v1.conf");
    expect(plan.files[0]!.content).toBe("version=v1");
  });

  test("ctx.preset overrides defaultPreset in env, paths and files", async () => {
    const recipe = loadDataRecipe({
      name: "tmpl-override",
      description: "override",
      defaultPreset: "v1",
      installSteps: [{ id: "s", label: "l", cmd: "tool get {{preset}}" }],
      env: { TOOL_HOME: "/opt/tool/{{preset}}" },
      paths: ["/opt/tool/{{preset}}/bin"],
      files: [{ path: "/etc/tool/{{preset}}.conf", content: "version={{preset}}" }],
    });
    const plan = await recipe.resolve({ runtime: "tmpl-override", version: "latest", preset: "v2", dryRun: false, options: {} });

    expect(plan.env['TOOL_HOME']).toBe("/opt/tool/v2");
    expect(plan.paths[0]).toBe("/opt/tool/v2/bin");
    expect(plan.files[0]!.path).toBe("/etc/tool/v2.conf");
    expect(plan.files[0]!.content).toBe("version=v2");
  });

  test("leaves foreign {{templates}} intact instead of treating them as variables", async () => {
    const recipe = loadDataRecipe({
      name: "tmpl-foreign",
      description: "writes a config that uses another tool's template syntax",
      defaultPreset: "mysite",
      installSteps: [{ id: "s", label: "l", cmd: "setup {{preset}} --tpl '{{server_name}}'" }],
      files: [{
        path: "/etc/nginx/{{preset}}.conf",
        content: "server_name {{server_name}};\nroot /srv/{{preset}};",
      }],
    });
    const plan = await recipe.resolve({ runtime: "tmpl-foreign", version: "latest", dryRun: false, options: {} });

    expect(plan.installSteps[0]!.cmd).toBe("setup mysite --tpl '{{server_name}}'");
    expect(plan.files[0]!.path).toBe("/etc/nginx/mysite.conf");
    expect(plan.files[0]!.content).toBe("server_name {{server_name}};\nroot /srv/mysite;");
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
