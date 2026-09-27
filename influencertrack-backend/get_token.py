from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_ANON_KEY"))

# Create a test user (if it already exists, sign in instead)
email = os.getenv("TEST_EMAIL", "test@example.com")
password = os.getenv("TEST_PASSWORD", "SecretPassword123")

try:
    res = supabase.auth.sign_up({"email": email, "password": password})
    token = res.session.access_token
except Exception:
    # User might already exist, so sign in instead
    res = supabase.auth.sign_in_with_password({"email": email, "password": password})
    token = res.session.access_token

print("\n" + "="*50)
print("YOUR TOKEN IS:")
print(token)
print("="*50 + "\n")
