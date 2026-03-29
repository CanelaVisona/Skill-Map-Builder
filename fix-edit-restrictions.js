const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client/src/components/SkillDesigner.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Replace the if (!isFirstNode) guard around setEditingSkillId calls in locked skills
content = content.replace(/onClick=\{\(\) => \{\s*if \(!isFirstNode\) \{\s*setEditingSkillId/g, 
                         'onClick={() => {\n                                                setEditingSkillId');

// Remove the closing brace of the if statement
content = content.replace(/setEditingSkillId\(skill\.id\);\s*setEditingName\(skill\.title \|\| ""\);\s*setEditingAreaId\(null\);\s*setEditingProjectId\(project\.id\);\s*setEditingLevel\(level\);\s*\}\s*\}\}/g,
                         'setEditingSkillId(skill.id);\n                                                setEditingName(skill.title || "");\n                                                setEditingAreaId(null);\n                                                setEditingProjectId(project.id);\n                                                setEditingLevel(level);\n                                              }}');

// Replace {!isFirstNode && ( <div...>  with just <div...>
content = content.replace(/\{!isFirstNode && \(\s*<div className="flex items-center gap-1">/g,
                         '<div className="flex items-center gap-1">');

// Replace the closing )}}  with just }}
let inLockedSkills = false;
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('if (!isFirstNode') && lines[i].includes('setEditingSkillId')) {
    inLockedSkills = true;
  }
  if (inLockedSkills && lines[i].trim() === ')}') {
    // Look ahead to see if this closes the conditional
    if (i + 1 < lines.length && lines[i + 1].trim() === '}') {
      lines[i] = lines[i].replace(/\)\}/, '}');
      inLockedSkills = false;
    }
  }
}
content = lines.join('\n');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed edit restrictions in SkillDesigner.tsx');
