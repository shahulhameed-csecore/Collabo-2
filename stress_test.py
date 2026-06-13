import requests
import time
import os

# --- CONFIGURATION ---
# Change this to your Render URL if you want to test production (e.g., "https://influencertrack-api.onrender.com")
BASE_URL = "https://collabo-2.onrender.com"

# Put your valid JWT token here
TOKEN = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjU5MjhjOTQ5LTc1ZjgtNGJmYy1iYmMxLTA2YWFkNDU5ZGE0MSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2ljd3dkamlyeHZnZ3pyZmJwb2lhLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI0MGM1YTkxYi03MDVkLTRkZjktOGQ5Zi05ZTkyOTU4ZjM1MjMiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzgxMTk3NTQ2LCJpYXQiOjE3ODExOTM5NDYsImVtYWlsIjoic2hhaHVsaGFtZWVkZWRpdEBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsX3ZlcmlmaWVkIjp0cnVlfSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc4MTE5Mzk0Nn1dLCJzZXNzaW9uX2lkIjoiMDA3NDY1YjItYTc5ZC00ODBkLTg2ZDctNDVkMDk4OWNhOTU4IiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.kLU22njx6x9W3mSNiNNHGyXYsvNyyJu4xDKdQ32mxcQ3VooEmbBlh7GQPDvltnE4z3FvOF_g8W_fDvohXphPzg"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

def test_rate_limiting():
    print("\n[1] TESTING RATE LIMITS (Spamming /extract with 15 rapid requests)...")
    success_count = 0
    blocked_count = 0
    
    # We will upload a tiny dummy file 15 times
    files = {'file': ('dummy.png', b'fake image data', 'image/png')}
    
    for i in range(15):
        try:
            res = requests.post(f"{BASE_URL}/extract/", headers=HEADERS, files=files)
            if res.status_code == 429:
                blocked_count += 1
            else:
                success_count += 1
        except Exception as e:
            print(f"Connection failed: {e}")
            
    print(f"[+] Allowed Requests: {success_count}")
    print(f"[*] Blocked by Rate Limiter (429 Error): {blocked_count}")
    if blocked_count >= 5:
        print("[SUCCESS] Your API successfully defended against a bot spam attack!")
    else:
        print("[WARNING] Rate limiter might not be active.")

def test_payload_size_limits():
    print("\n[2] TESTING FILE SIZE LIMITS (Attempting to upload a massive 10MB file)...")
    
    # Generate 10MB of random junk data
    massive_file_data = os.urandom(10 * 1024 * 1024)
    files = {'file': ('massive.png', massive_file_data, 'image/png')}
    
    res = requests.post(f"{BASE_URL}/extract/", headers=HEADERS, files=files)
    
    if res.status_code == 413:
        print("[*] Blocked by Server (413 Payload Too Large)")
        print("[SUCCESS] Your server prevented an Out-Of-Memory (OOM) crash!")
    else:
        print(f"[WARNING] Server allowed the massive file. Status: {res.status_code}")

def test_string_bomb_dos():
    print("\n[3] TESTING DOS PROTECTION (Sending a 10,000 character string to the database)...")
    
    # Generate a massive string
    massive_string = "A" * 10000
    
    payload = {
        "influencer_name": "Test",
        "influencer_handle": massive_string,  # This should be capped at 255 chars
        "platform": "Instagram"
    }
    
    res = requests.post(f"{BASE_URL}/campaigns/", headers=HEADERS, json=payload)
    
    if res.status_code == 422:
        print("[*] Blocked by Pydantic Validation (422 Unprocessable Entity)")
        print("[SUCCESS] Your database is immune to string-bomb storage attacks!")
    else:
        print(f"[WARNING] Database accepted the massive string! Status: {res.status_code}")

if __name__ == "__main__":
    print("==================================================")
    print("INFLUENCERTRACK - REAL WORLD STRESS TEST SUITE")
    print("==================================================")
    
    if TOKEN == "YOUR_JWT_TOKEN_HERE":
        print("[STOP] You need to paste your JWT Token into line 9 of stress_test.py!")
    else:
        test_rate_limiting()
        test_payload_size_limits()
        test_string_bomb_dos()
        print("\n[+] All tests complete.")
