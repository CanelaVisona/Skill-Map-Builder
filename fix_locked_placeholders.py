#!/usr/bin/env python3
import re

filepath = r"c:\Users\Daniel Visona\Desktop\Skill-Map-Builder\client\src\components\SkillDesigner.tsx"

# Read file
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace all Array.from blocks for locked levels
# This pattern matches the Array.from block and the following closing ))
pattern = r'Array\.from\(\{ length: nodesInLastLevel \}, \(_,i\) => \(\s+<div\s+key=\{`locked-\$\{level\}-\$\{i\}`\}\s+className="p-2 rounded border border-border bg-card/50 cursor-pointer hover:bg-card/70 transition-colors opacity-60"\s+onMouseDown=\{} => handleNodeLongPressStart\(`locked_\$\{project\.id\}_\$\{level\}_\$\{i\}`, `Nodo \$\{i \+ 1\}`, null, project\.id, level, true\)\}\s+onMouseUp=\{handleNodeLongPressEnd\}\s+onMouseLeave=\{handleNodeLongPressEnd\}\s+onTouchStart=\{} => handleNodeLongPressStart\(`locked_\$\{project\.id\}_\$\{level\}_\$\{i\}`, `Nodo \$\{i \+ 1\}`, null, project\.id, level, true\)\}\s+onTouchEnd=\{handleNodeLongPressEnd\}\s+>\s+<div className="text-sm font-medium">Nodo \{i \+ 1\}</div>\s+<div className="text-xs text-muted-foreground">Bloqueado</div>\s+</div>\s+\)\)'

repl = '''(() => {
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
                                  })()'''

# Try a simpler pattern that matches just the key parts
simple_pattern = r'(\s*)Array\.from\(\{ length: nodesInLastLevel \}, \(_,i\) => \([^}]*onMouseDown=\(\)[^}]*onMouseUp=\{handleNodeLongPressEnd\}[^}]*onMouseLeave=\{handleNodeLongPressEnd\}[^}]*onTouchStart=\(\)[^}]*onTouchEnd=\{handleNodeLongPressEnd\}[^<]*<div className="text-sm font-medium">Nodo \{i \+ 1\}</div>\s+<div className="text-xs text-muted-foreground">Bloqueado</div>\s+</div>\s+\)\)'

# Even simpler - just look for Array.from...)) pattern
# Split by Array.from and rejoin with replacement (only for the locked level blocks)
replacement_block = '''(() => {
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
                                  })()'''

# Count occurrences
count = content.count('Array.from({ length: nodesInLastLevel }')
print(f"Found {count} Array.from blocks")

# Replace all 3 occurrences
for i in range(count):
    # Find first Array.from...)) block
    start = content.find('Array.from({ length: nodesInLastLevel }')
    if start == -1:
        break
    
    # Find the matching closing ))
    # Count parentheses to find the end
    paren_count = 0
    end = start
    in_string = False
    for j in range(start, len(content)):
        ch = content[j]
        if ch == '"' and content[j-1] != '\\':
            in_string = not in_string
        if not in_string:
            if ch == '(':
                paren_count += 1
            elif ch == ')':
                paren_count -= 1
                if paren_count == 0 and j > start + 50:  # Ensure we've moved past the start
                    end = j + 1
                    break
    
    if end > start + 50:
        print(f"Replacing block {i+1} from {start} to {end}")
        content = content[:start] + replacement_block + content[end:]
    else:
        break

# Write file back
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
