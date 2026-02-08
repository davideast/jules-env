import type { Recipe } from './spec';

export class CircularDependencyError extends Error {
  constructor(public chain: string[]) {
    super(`Circular dependency detected: ${chain.join(' -> ')}`);
    this.name = 'CircularDependencyError';
  }
}

export class MissingDependencyError extends Error {
  constructor(public from: string, public missing: string) {
    super(`Recipe '${from}' depends on missing recipe '${missing}'`);
    this.name = 'MissingDependencyError';
  }
}

export function resolveDependencies(
  recipeName: string,
  registry: Record<string, Recipe>,
): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function walk(name: string, chain: string[]) {
    if (visited.has(name)) return;
    if (visiting.has(name)) throw new CircularDependencyError([...chain, name]);

    const recipe = registry[name];
    if (!recipe) {
      if (chain.length > 0) {
        throw new MissingDependencyError(chain[chain.length - 1]!, name);
      }
      throw new Error(`Recipe '${name}' not found`);
    }

    visiting.add(name);
    for (const dep of recipe.depends ?? []) {
      walk(dep, [...chain, name]);
    }
    visiting.delete(name);

    visited.add(name);
    result.push(name);
  }

  walk(recipeName, []);
  return result;
}
