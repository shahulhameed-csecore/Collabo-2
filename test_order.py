import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

resp1 = supabase.table("campaigns").select("*").eq("status", "draft").ilike("special_notes", "%[tg_update:%").order("created_at", desc=True).limit(5).execute()
print("DESC=True:")
for r in resp1.data:
    print(r["created_at"])

resp2 = supabase.table("campaigns").select("*").eq("status", "draft").ilike("special_notes", "%[tg_update:%").order("created_at", desc=False).limit(5).execute()
print("DESC=False:")
for r in resp2.data:
    print(r["created_at"])
