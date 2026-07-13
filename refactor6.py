import os
import re

directory = "c:\\Users\\shahu\\Desktop\\collabo-part-2 - Copy\\influencertrack-backend\\app"

def refactor_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # 1. Threadpools
    content = re.sub(r'await run_in_threadpool\(\s*lambda:\s*(.*?)\)', r'\1', content)
    content = re.sub(r'await asyncio\.to_thread\(\s*lambda:\s*(.*?)\)', r'\1', content)
    
    # dependencies and notifications handles manually below
    if 'dependencies.py' in filepath:
        content = content.replace('def get_service_client():', 'async def get_service_client():')
        content = content.replace('create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)', 'await create_async_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)')
        content = content.replace('def get_current_user', 'async def get_current_user')
        content = content.replace('user_response = supabase.auth.get_user(token)', 'service_client = await get_service_client()\n        user_response = await service_client.auth.get_user(token)')
        content = content.replace('def get_user_supabase_client', 'async def get_user_supabase_client')
        content = content.replace('client = create_client(', 'client = await create_async_client(')
        content = content.replace('from supabase import create_client, ClientOptions', 'from supabase import create_async_client, AsyncClient, ClientOptions')
    elif 'notifications.py' in filepath:
        content = content.replace('resp = service_client.table("notifications").insert(data).execute()', 'resp = await service_client.table("notifications").insert(data).execute()')
    else:
        # non-dependencies functions
        content = content.replace('def _generate_unique_short_code(client, max_retries=5) -> str:', 'async def _generate_unique_short_code(client, max_retries=5) -> str:')
        
        content = re.sub(r'(?<!await\s)\bget_service_client\(', r'await get_service_client(', content)
        content = re.sub(r'(?<!await\s)\b_generate_unique_short_code\(', r'await _generate_unique_short_code(', content)
    
        # 2. Add await
        content = re.sub(r'(?<!await\s)\bclient\.table\(', r'await client.table(', content)
        content = re.sub(r'(?<!await\s)\bservice_client\.table\(', r'await service_client.table(', content)
        content = re.sub(r'(?<!await\s)\bsupabase_admin\.table\(', r'await supabase_admin.table(', content)
        content = re.sub(r'(?<!await\s)\bsupabase\.table\(', r'await supabase.table(', content)
        
        content = re.sub(r'(?<!await\s)\bclient\.rpc\(', r'await client.rpc(', content)
        content = re.sub(r'(?<!await\s)\bservice_client\.rpc\(', r'await service_client.rpc(', content)
        content = re.sub(r'(?<!await\s)\bsupabase_admin\.rpc\(', r'await supabase_admin.rpc(', content)
        content = re.sub(r'(?<!await\s)\bsupabase\.rpc\(', r'await supabase.rpc(', content)
        
        # 4. Fix router definitions
        content = re.sub(r'(@router\.[a-z]+\(.*?\)\n(?:@[^\n]*\n)*)def ', r'\1async def ', content)

        # Fix lambda remaining syntax
        content = re.sub(r'lambda:\s*await\s*', r'lambda: ', content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Refactored {filepath}")

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith(".py"):
            refactor_file(os.path.join(root, file))
