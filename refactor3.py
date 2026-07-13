import os
import re

directory = "c:\\Users\\shahu\\Desktop\\collabo-part-2 - Copy\\influencertrack-backend\\app"

def refactor_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # 1. Strip asyncio/threadpool
    # await run_in_threadpool(lambda: client.table().execute()) -> await client.table().execute()
    # Note: run_in_threadpool(lambda: ...) usually has an execute or something. If it's already an await we don't want to double await.
    content = re.sub(r'await run_in_threadpool\(\s*lambda:\s*(.*?)\)', r'\1', content)
    content = re.sub(r'await asyncio\.to_thread\(\s*lambda:\s*(.*?)\)', r'\1', content)
    
    # 2. Add await to queries
    # Make sure we don't double await.
    content = re.sub(r'(?<!await\s)(?<!await\s\s)\b(client|service_client|supabase_admin|supabase|db_client)\.table\(', r'await \1.table(', content)
    content = re.sub(r'(?<!await\s)(?<!await\s\s)\b(client|service_client|supabase_admin|supabase|db_client)\.rpc\(', r'await \1.rpc(', content)
    
    # 3. Handle routers and specific functions
    if 'dependencies.py' in filepath:
        content = content.replace('def get_service_client():', 'async def get_service_client() -> AsyncClient:')
        content = content.replace('create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)', 'await create_async_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)')
        content = content.replace('def get_current_user', 'async def get_current_user')
        content = content.replace('user_response = supabase.auth.get_user(token)', 'service_client = await get_service_client()\n        user_response = await service_client.auth.get_user(token)')
        content = content.replace('def get_user_supabase_client', 'async def get_user_supabase_client')
        content = content.replace('client = create_client(', 'client = await create_async_client(')
        content = content.replace('from supabase import create_client, ClientOptions', 'from supabase import create_async_client, AsyncClient, ClientOptions')
    else:
        # For non-dependencies, `get_service_client()` should be awaited.
        content = re.sub(r'(?<!await\s)\bget_service_client\(', r'await get_service_client(', content)
        content = re.sub(r'(?<!await\s)\b_generate_unique_short_code\(', r'await _generate_unique_short_code(', content)
        content = content.replace('def _generate_unique_short_code(client, max_retries=5) -> str:', 'async def _generate_unique_short_code(client, max_retries=5) -> str:')

    # 4. Fix router definitions
    content = re.sub(r'(@router\.[a-z]+\(.*?\)\n(?:@[^\n]*\n)*)def ', r'\1async def ', content)
    
    # fix lambda: await ... that came from stripping threadpool but the function was inside a lambda
    # Actually wait: `lambda: await` is invalid syntax. We replaced `await asyncio.to_thread(lambda: client.table())` with `client.table()`.
    # And then the regex for client.table will make it `await client.table()`. So it's fine.
    
    # Fix any accidental `await await`
    content = re.sub(r'await\s+await\s+', 'await ', content)
    
    # Wait, some queries inside billing.py or whatsapp.py might still have `lambda: await client.table()` if there was `asyncio.to_thread(lambda: await client.table())`. But that's invalid syntax in the original anyway.
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Refactored {filepath}")

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith(".py"):
            refactor_file(os.path.join(root, file))
