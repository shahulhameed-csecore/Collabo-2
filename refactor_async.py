import os
import re

directory = "c:\\Users\\shahu\\Desktop\\collabo-part-2 - Copy\\influencertrack-backend\\app"

def refactor_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # regex to find functions that contain await
    # We find all `def foo(...):` and the body inside it up to the next `def ` or end of file
    # If the body contains `\bawait\b` and the `def ` is not preceded by `async `, we change it to `async def `
    
    parts = re.split(r'(\n\s*def\s+\w+\(.*?\):)', content, flags=re.DOTALL)
    
    # parts[0] is everything before the first def
    # parts[1] is the first def signature
    # parts[2] is the body, up to the next def... Wait, re.split with a group will interleave.
    
    for i in range(1, len(parts), 2):
        signature = parts[i]
        body = parts[i+1]
        
        # Check if body has await
        if re.search(r'\bawait\b', body) or re.search(r'\bawait\b', signature):
            # check if the preceding text ends with 'async '
            preceding = parts[i-1]
            if not preceding.endswith('async '):
                parts[i-1] = preceding + 'async '

    new_content = ''.join(parts)
    
    # Also clean up `async async def` just in case
    new_content = re.sub(r'async\s+async\s+def', 'async def', new_content)
    new_content = re.sub(r'async\s+async\s+async\s+def', 'async def', new_content)
    
    if new_content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Refactored {filepath}")

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith(".py"):
            refactor_file(os.path.join(root, file))
