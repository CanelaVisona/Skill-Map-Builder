const fs = require('fs');
const filepath = 'client/src/components/SkillDesigner.tsx';
let content = fs.readFileSync(filepath, 'utf-8');

const replacement = `(() => {
                                    const lockedLevelSkills = project.skills
                                      .filter((s) => s.level === level)
                                      .sort((a, b) => a.y - b.y);
                                    
                                    return lockedLevelSkills.map((skill) => (
                                      <div
                                        key={skill.id}
                                        className="p-2 rounded border border-border bg-card/50 hover:bg-card transition-colors opacity-60"
                                      >
                                        <div className="text-sm font-medium">{!skill.title || skill.title.toLowerCase().includes("challenge") || skill.title.toLowerCase().includes("objective quest") ? "-" : skill.title}</div>
                                        <div className="text-xs text-muted-foreground">Bloqueado</div>
                                      </div>
                                    ));
                                  })()`;

// Find and replace
let blockCount = 0;
content = content.replace(/Array\.from\(\{ length: nodesInLastLevel \}, \(_,i\) => \([\s\S]*?\n\s+\)\)\)/g, (match) => {
  blockCount++;
  console.log('Replacing block ' + blockCount);
  return replacement;
});

fs.writeFileSync(filepath, content);
console.log('Done! Replaced ' + blockCount + ' blocks');
