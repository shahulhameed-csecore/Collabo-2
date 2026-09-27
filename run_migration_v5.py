import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(r"C:\Users\shahu\Desktop\collabo-part-2\influencertrack-backend\.env")

db_url = os.environ.get("DATABASE_URL")
if not db_url:
    print("DATABASE_URL not found")
    exit(1)

with open(r"C:\Users\shahu\Desktop\collabo-part-2\influencertrack-backend\supabase_migrations_v5.sql", "r") as f:
    sql = f.read()

conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()
cur.execute(sql)
print("Migration v5 executed successfully.")
cur.close()
conn.close()
