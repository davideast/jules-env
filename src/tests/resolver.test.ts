import { describe, test, expect } from "bun:test";
import { resolveDependencies, CircularDependencyError, MissingDependencyError } from '../core/resolver';
import type { Recipe } from '../core/spec';

const mockRecipe = (name: string, depends?: string[]): Recipe => ({
  name,
  description: 'Mock recipe',
  depends,
  resolve: async () => ({ installSteps: [], env: {}, paths: [], files: [] }),
});

describe("Dependency Resolver", () => {
  test("returns single recipe when no dependencies", () => {
    const registry = {
      dart: mockRecipe('dart'),
    };
    const result = resolveDependencies('dart', registry);
    expect(result).toEqual(['dart']);
  });

  test("resolves direct dependency", () => {
    const registry = {
      'php': mockRecipe('php'),
      'php-sqlite': mockRecipe('php-sqlite', ['php']),
    };
    const result = resolveDependencies('php-sqlite', registry);
    expect(result).toEqual(['php', 'php-sqlite']);
  });

  test("resolves transitive dependencies", () => {
    const registry = {
      'php': mockRecipe('php'),
      'php-sqlite': mockRecipe('php-sqlite', ['php']),
      'laravel': mockRecipe('laravel', ['php-sqlite']),
    };
    const result = resolveDependencies('laravel', registry);
    expect(result).toEqual(['php', 'php-sqlite', 'laravel']);
  });

  test("deduplicates shared dependencies", () => {
    // a -> b, a -> c, b -> d, c -> d
    // order should be d, b, c, a or d, c, b, a depending on iteration order
    const registry = {
      'd': mockRecipe('d'),
      'b': mockRecipe('b', ['d']),
      'c': mockRecipe('c', ['d']),
      'a': mockRecipe('a', ['b', 'c']),
    };
    const result = resolveDependencies('a', registry);
    expect(result).toHaveLength(4);
    expect(result[0]).toBe('d'); // d must be first
    expect(result[3]).toBe('a'); // a must be last
    // b and c are in the middle
    expect(result.slice(1, 3).sort()).toEqual(['b', 'c']);
  });

  test("throws CircularDependencyError on direct cycle", () => {
    const registry = {
      'a': mockRecipe('a', ['a']),
    };
    expect(() => resolveDependencies('a', registry)).toThrow(CircularDependencyError);
  });

  test("throws CircularDependencyError on indirect cycle", () => {
    const registry = {
      'a': mockRecipe('a', ['b']),
      'b': mockRecipe('b', ['a']),
    };
    expect(() => resolveDependencies('a', registry)).toThrow(CircularDependencyError);
  });

  test("circular error message contains chain", () => {
    const registry = {
      'a': mockRecipe('a', ['b']),
      'b': mockRecipe('b', ['c']),
      'c': mockRecipe('c', ['a']),
    };
    try {
      resolveDependencies('a', registry);
    } catch (e: any) {
      expect(e).toBeInstanceOf(CircularDependencyError);
      expect(e.message).toContain('a -> b -> c -> a');
    }
  });

  test("throws MissingDependencyError when dep not found", () => {
    const registry = {
      'a': mockRecipe('a', ['missing']),
    };
    expect(() => resolveDependencies('a', registry)).toThrow(MissingDependencyError);
  });

  test("missing error message names both recipes", () => {
    const registry = {
      'a': mockRecipe('a', ['missing']),
    };
    try {
      resolveDependencies('a', registry);
    } catch (e: any) {
      expect(e).toBeInstanceOf(MissingDependencyError);
      expect(e.message).toContain("Recipe 'a' depends on missing recipe 'missing'");
    }
  });

  test("handles empty depends array", () => {
    const registry = {
      'a': mockRecipe('a', []),
    };
    const result = resolveDependencies('a', registry);
    expect(result).toEqual(['a']);
  });

  test("throws Error if target recipe not found", () => {
      const registry = {};
      expect(() => resolveDependencies('unknown', registry)).toThrow("Recipe 'unknown' not found");
  });
});
