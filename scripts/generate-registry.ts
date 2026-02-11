/**
 * Build-time codegen: scans src/recipes/ and generates src/recipes/_registry.ts
 * so the compiled binary doesn't need runtime filesystem scanning.
 *
 * Run: bun run scripts/generate-registry.ts
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const recipesDir = join(import.meta.dir, '..', 'src', 'recipes');
const outFile = join(recipesDir, '_registry.ts');

const files = readdirSync(recipesDir)
  .filter((f) => {
    if (f.startsWith('_')) return false;
    const ext = extname(f);
    return ext === '.ts' || ext === '.json';
  })
  .sort();

const imports: string[] = [];
const entries: string[] = [];

for (const file of files) {
  const ext = extname(file);
  const name = basename(file, ext);
  // Create a safe identifier from the filename (e.g. "php-sqlite" -> "php_sqlite")
  const ident = name.replace(/[^a-zA-Z0-9]/g, '_');

  if (ext === '.ts') {
    imports.push(`import { recipe as ${ident} } from './${name}';`);
    entries.push(`  [${ident}.name]: ${ident},`);
  } else if (ext === '.json') {
    imports.push(`import ${ident}Data from './${name}.json';`);
    imports.push(`const ${ident} = loadDataRecipe(${ident}Data);`);
    entries.push(`  [${ident}.name]: ${ident},`);
  }
}

const code = `// AUTO-GENERATED — do not edit. Run: bun run scripts/generate-registry.ts
import type { Recipe } from '../core/spec';
import { loadDataRecipe } from '../core/loader';
${imports.join('\n')}

export const recipes: Record<string, Recipe> = {
${entries.join('\n')}
};
`;

writeFileSync(outFile, code);
console.log(`Generated ${outFile} with ${files.length} recipes`);
