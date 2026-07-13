import os
import re

directory = "c:\\Users\\shahu\\Desktop\\collabo-part-2 - Copy\\influencertrack-backend\\app"

def refactor_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Replace run_in_threadpool(lambda: X) with await X
    content = re.sub(r'await run_in_threadpool\(lambda:\s*(.*?\.execute\(\))\)', r'await \1', content)
    
    # Replace asyncio.to_thread(lambda: X) with await X
    content = re.sub(r'await asyncio\.to_thread\(lambda:\s*(.*?\.execute\(\))\)', r'await \1', content)
    
    # Add await to client.table
    content = re.sub(r'(?<!await\s)client\.table\(', r'await client.table(', content)
    content = re.sub(r'(?<!await\s)service_client\.table\(', r'await service_client.table(', content)
    content = re.sub(r'(?<!await\s)supabase_admin\.table\(', r'await supabase_admin.table(', content)
    content = re.sub(r'(?<!await\s)supabase\.table\(', r'await supabase.table(', content)
    
    # Add await to .rpc
    content = re.sub(r'(?<!await\s)client\.rpc\(', r'await client.rpc(', content)
    content = re.sub(r'(?<!await\s)service_client\.rpc\(', r'await service_client.rpc(', content)
    content = re.sub(r'(?<!await\s)supabase_admin\.rpc\(', r'await supabase_admin.rpc(', content)
    content = re.sub(r'(?<!await\s)supabase\.rpc\(', r'await supabase.rpc(', content)
    
    # Fix routes to be async def
    content = re.sub(r'(@router\..*?\n(?:@[^\n]*\n)*)def ', r'\1async def ', content)
    
    # Fix specific await for _generate_unique_short_code
    content = re.sub(r'def _generate_unique_short_code', r'async def _generate_unique_short_code', content)
    content = re.sub(r'(?<!await\s)_generate_unique_short_code\(', r'await _generate_unique_short_code(', content)
    
    # Fix get_service_client
    content = re.sub(r'(?<!await\s)get_service_client\(', r'await get_service_client(', content)
    
    # Fix `await await`
    content = re.sub(r'await\s+await', 'await', content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Refactored {filepath}")

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith(".py"):
            refactor_file(os.path.join(root, file))
