import os
import re

directory = "c:\\Users\\shahu\\Desktop\\collabo-part-2 - Copy\\influencertrack-backend\\app"

def refactor_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # 1. Threadpools
    content = re.sub(r'await run_in_threadpool\(lambda:\s*(.*?)\)', r'await \1', content)
    content = re.sub(r'await asyncio\.to_thread\(lambda:\s*(.*?)\)', r'await \1', content)
    
    # 2. Supabase clients (simple find and replace with safe deduplication later)
    content = content.replace('client.table(', 'await client.table(')
    content = content.replace('service_client.table(', 'await service_client.table(')
    content = content.replace('supabase_admin.table(', 'await supabase_admin.table(')
    content = content.replace('supabase.table(', 'await supabase.table(')
    
    content = content.replace('client.rpc(', 'await client.rpc(')
    content = content.replace('service_client.rpc(', 'await service_client.rpc(')
    content = content.replace('supabase_admin.rpc(', 'await supabase_admin.rpc(')
    content = content.replace('supabase.rpc(', 'await supabase.rpc(')

    # 3. Fix dependencies logic manually by string replace instead of regex
    # In dependencies.py
    if 'dependencies.py' in filepath:
        content = content.replace('def get_service_client():', 'async def get_service_client() -> AsyncClient:')
        content = content.replace('create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)', 'await create_async_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)')
        content = content.replace('def get_current_user', 'async def get_current_user')
        content = content.replace('user_response = supabase.auth.get_user(token)', 'service_client = await get_service_client()\n        user_response = await service_client.auth.get_user(token)')
        content = content.replace('def get_user_supabase_client', 'async def get_user_supabase_client')
        content = content.replace('client = create_client(', 'client = await create_async_client(')
        content = content.replace('from supabase import create_client, ClientOptions', 'from supabase import create_async_client, AsyncClient, ClientOptions')
        # fix the `await supabase.table` which would apply to supabase.auth... oh wait we don't have supabase.table there.
    else:
        # For non-dependencies, `get_service_client()` should be awaited.
        content = content.replace('get_service_client()', 'await get_service_client()')
        content = content.replace('_generate_unique_short_code(client)', 'await _generate_unique_short_code(client)')
        # make the short_code fn async
        content = content.replace('def _generate_unique_short_code(client, max_retries=5) -> str:', 'async def _generate_unique_short_code(client, max_retries=5) -> str:')

    # 4. Fix router definitions
    content = re.sub(r'(@router\.[a-z]+\(.*?\)\n(?:@[^\n]*\n)*)def ', r'\1async def ', content)
    
    # fix edge case: if we double awaited
    content = re.sub(r'await\s+await\s+', 'await ', content)
    content = re.sub(r'await\s+await\s+', 'await ', content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Refactored {filepath}")

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith(".py"):
            refactor_file(os.path.join(root, file))
