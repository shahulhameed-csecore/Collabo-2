import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

resp = supabase.table("campaigns").select("*").order("created_at", desc=True).limit(5).execute()
for r in resp.data:
    print(f"ID: {r['id']}, Status: {r['status']}, Name: '{r.get('influencer_name')}', Notes: '{r.get('special_notes')}'")
