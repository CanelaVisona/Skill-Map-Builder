const fs = require('fs');
const content = fs.readFileSync('client/src/components/SkillDesigner.tsx', 'utf-8');
const lines = content.split('\n');

let modifications = 0;
let inDesbloqueadoSection = false;
let lastIsFirstNodeLine = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Track when we're in a desbloqueado section with isFirstNode
  if (line.includes('const isFirstNode = skill.levelPosition')) {
    inDesbloqueadoSection = true;
    lastIsFirstNodeLine = i;
  }
  
  // Find the skill title display line in each section
  if (inDesbloqueadoSection && i > lastIsFirstNodeLine && i < lastIsFirstNodeLine + 20) {
    if (line.includes('!skill.title') && line.includes('? "-"') && !lines[i - 1].includes('Array.from')) {
      lines[i] = line.replace(
        /\{!skill\.title.*?\? "-" : skill\.title\}/,
        '{isFirstNode ? "Nodo de inicio" : (!skill.title || skill.title.toLowerCase().includes("challenge") || skill.title.toLowerCase().includes("objective quest") ? "Objective quest" : skill.title)}'
      );
      modifications++;
      console.log(`Modified line ${i + 1}`);
    }
  }
  
  // Reset flag when moving to next isFirstNode or endBlockStatement
  if (i > lastIsFirstNodeLine + 20 && line.includes('});')) {
    inDesbloqueadoSection = false;
  }
}

// Also fix the Array.from sections for locked nodes (show "Nodo de inicio" when i === 0)
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Array.from') && lines[i].includes('nodesInLastLevel')) {
    // Find the line that shows "Nodo {i + 1}"
    for (let j = i; j < Math.min(i + 15, lines.length); j++) {
      if (lines[j].includes('Nodo {i + 1}')) {
        lines[j] = lines[j].replace(
          /Nodo \{i \+ 1\}/,
          '{i === 0 ? "Nodo de inicio" : `Nodo ${i + 1}`}'
        );
        modifications++;
        console.log(`Modified Array.from line ${j + 1}`);
        break;
      }
    }
  }
}

fs.writeFileSync('client/src/components/SkillDesigner.tsx', lines.join('\n'));
console.log(`\nDone! Made ${modifications} modifications`);
