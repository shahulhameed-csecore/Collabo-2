import os
import re

directory = "c:\\Users\\shahu\\Desktop\\collabo-part-2 - Copy\\influencertrack-backend\\app"

def refactor_file(filepath):
    # skip dependencies.py and notifications.py since we just fixed them
    if 'dependencies.py' in filepath or 'notifications.py' in filepath:
        return

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # 1. Threadpools
    content = re.sub(r'await run_in_threadpool\(\s*lambda:\s*(.*?)\)', r'\1', content)
    content = re.sub(r'await asyncio\.to_thread\(\s*lambda:\s*(.*?)\)', r'\1', content)
    
    # 2. Queries with proper boundaries to avoid 'db_await client' or 'service_await client'
    # Use negative lookbehind to ensure we don't double await.
    content = re.sub(r'(?<!await\s)\bclient\.table\(', r'await client.table(', content)
    content = re.sub(r'(?<!await\s)\bservice_client\.table\(', r'await service_client.table(', content)
    content = re.sub(r'(?<!await\s)\bsupabase_admin\.table\(', r'await supabase_admin.table(', content)
    content = re.sub(r'(?<!await\s)\bsupabase\.table\(', r'await supabase.table(', content)
    
    content = re.sub(r'(?<!await\s)\bclient\.rpc\(', r'await client.rpc(', content)
    content = re.sub(r'(?<!await\s)\bservice_client\.rpc\(', r'await service_client.rpc(', content)
    content = re.sub(r'(?<!await\s)\bsupabase_admin\.rpc\(', r'await supabase_admin.rpc(', content)
    content = re.sub(r'(?<!await\s)\bsupabase\.rpc\(', r'await supabase.rpc(', content)
    
    # Other specific functions that are now async
    content = re.sub(r'(?<!await\s)\bget_service_client\(', r'await get_service_client(', content)
    content = re.sub(r'(?<!await\s)\b_generate_unique_short_code\(', r'await _generate_unique_short_code(', content)
    
    content = content.replace('def _generate_unique_short_code(client, max_retries=5) -> str:', 'async def _generate_unique_short_code(client, max_retries=5) -> str:')

    # 4. Fix router definitions
    content = re.sub(r'(@router\.[a-z]+\(.*?\)\n(?:@[^\n]*\n)*)def ', r'\1async def ', content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Refactored {filepath}")

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith(".py"):
            refactor_file(os.path.join(root, file))
