import { performance } from 'perf_hooks';
import { SwiftRecipe } from './src/recipes/swift.ts';
import { UseContextSchema } from './src/core/spec.ts';

async function runBenchmark() {
  const ctx = UseContextSchema.parse({ runtime: 'swift' });

  // Warmup
  try { await SwiftRecipe.resolve(ctx); } catch(e) {}

  const start = performance.now();
  const promises = [];
  for (let i = 0; i < 50; i++) {
    promises.push(SwiftRecipe.resolve(ctx));
  }
  await Promise.all(promises);
  const end = performance.now();

  console.log(`Time taken for 50 concurrent resolve calls: ${end - start} ms`);
}

runBenchmark();
