const fs = require('fs');
const path = require('path');

const filePath = '/Users/matheuskistenmackerpires/Desktop/laudos-us/src/modules/ai/prompts.ts';
const destDir = '/Users/matheuskistenmackerpires/Desktop/laudos-us/src/modules/ai/prompts';
const areasDir = path.join(destDir, 'areas');

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
if (!fs.existsSync(areasDir)) fs.mkdirSync(areasDir, { recursive: true });

const content = fs.readFileSync(filePath, 'utf8');

function formatText(text) {
  // Standardize the decorative borders
  text = text.replace(/═{10,}/g, '═══════════════════════════════════════════════════════════════');
  text = text.replace(/─{10,}/g, '───────────────────────────────────────────────────────────────');
  return text;
}

// Extract variables
const masterMatch = content.match(/export const DEFAULT_MASTER_PROMPT = `([\s\S]*?)`;/);
const globalMatch = content.match(/export const DEFAULT_GLOBAL_INSTRUCTIONS = `([\s\S]*?)`;/);
const structureMatch = content.match(/export const DEFAULT_STRUCTURE_PROMPT = `([\s\S]*?)`;/);
const rigidMatch = content.match(/export const DEFAULT_RIGID_RULES = `([\s\S]*?)`;/);

const generalFileContent = `
export const DEFAULT_MASTER_PROMPT = \`${formatText(masterMatch[1])}\`;

export const DEFAULT_GLOBAL_INSTRUCTIONS = \`${formatText(globalMatch[1])}\`;

export const DEFAULT_STRUCTURE_PROMPT = \`${formatText(structureMatch[1])}\`;

export const DEFAULT_RIGID_RULES = \`${formatText(rigidMatch[1])}\`;
`;

fs.writeFileSync(path.join(destDir, 'general.ts'), generalFileContent.trim() + '\n');

// Extract AREA_SPECIFIC_PROMPTS
const areaPromptsMatch = content.match(/export const AREA_SPECIFIC_PROMPTS: Record<string, string> = {([\s\S]*?)};/);
const areaPromptsContent = areaPromptsMatch[1];

const areaRegex = /'([\w-]+)': `([\s\S]*?)`,/g;
let match;
const areas = [];

while ((match = areaRegex.exec(areaPromptsContent)) !== null) {
  const areaName = match[1];
  let areaContent = match[2];
  
  areaContent = formatText(areaContent);
  
  const varName = areaName.replace(/-([a-z])/g, (g) => g[1].toUpperCase()) + 'Prompt';
  const fileContent = `export const ${varName} = \`${areaContent}\`;\n`;
  
  fs.writeFileSync(path.join(areasDir, `${areaName}.ts`), fileContent);
  areas.push({ areaName, varName });
}

// Check if the last area didn't have a trailing comma
const lastAreaRegex = /'([\w-]+)': `([\s\S]*?)`\s*$/;
const lastMatch = areaPromptsContent.match(lastAreaRegex);
if (lastMatch && !areas.find(a => a.areaName === lastMatch[1])) {
  const areaName = lastMatch[1];
  let areaContent = lastMatch[2];
  areaContent = formatText(areaContent);
  const varName = areaName.replace(/-([a-z])/g, (g) => g[1].toUpperCase()) + 'Prompt';
  const fileContent = `export const ${varName} = \`${areaContent}\`;\n`;
  fs.writeFileSync(path.join(areasDir, `${areaName}.ts`), fileContent);
  areas.push({ areaName, varName });
}

// Generate index.ts
let indexContent = `export * from './general';\n\n`;
for (const area of areas) {
  indexContent += `import { ${area.varName} } from './areas/${area.areaName}';\n`;
}

indexContent += `\nexport const AREA_SPECIFIC_PROMPTS: Record<string, string> = {\n`;
for (const area of areas) {
  indexContent += `  '${area.areaName}': ${area.varName},\n`;
}
indexContent += `};\n`;

fs.writeFileSync(path.join(destDir, 'index.ts'), indexContent);
console.log('Split completed successfully.');
