const paths = Array.from({ length: 100 }, (_, i) => `/path/${i}`);
const env = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`VAR_${i}`, `VAL_${i}`]));

function benchConcat() {
  let stateContent = '';
  if (paths.length > 0) {
    stateContent += `export PATH="${paths.join(':')}:$PATH"\n`;
  }
  for (const [key, val] of Object.entries(env)) {
    stateContent += `export ${key}="${val}"\n`;
  }
  return stateContent;
}

function benchJoinPush() {
  const lines = [];
  if (paths.length > 0) {
    lines.push(`export PATH="${paths.join(':')}:$PATH"`);
  }
  for (const [key, val] of Object.entries(env)) {
    lines.push(`export ${key}="${val}"`);
  }
  const stateContent = lines.join('\n') + (lines.length > 0 ? '\n' : '');
  return stateContent;
}

function benchJoinMap() {
  const lines = Object.entries(env).map(([key, val]) => `export ${key}="${val}"`);
  if (paths.length > 0) {
    lines.unshift(`export PATH="${paths.join(':')}:$PATH"`);
  }
  return lines.length > 0 ? lines.join('\n') + '\n' : '';
}

const iterations = 10000;

console.time('concat');
for (let i = 0; i < iterations; i++) {
  benchConcat();
}
console.timeEnd('concat');

console.time('join-push');
for (let i = 0; i < iterations; i++) {
  benchJoinPush();
}
console.timeEnd('join-push');

console.time('join-map');
for (let i = 0; i < iterations; i++) {
  benchJoinMap();
}
console.timeEnd('join-map');
