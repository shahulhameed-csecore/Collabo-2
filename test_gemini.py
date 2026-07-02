import asyncio
from app.services.gemini import extract_campaign_data
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    text = "Bhai @thefashionguy ko lock kar do. 1 reel aur 3 stories chahiye. Payment 15k fix kiya hai. Post aaj shaam tak live hona chahiye"
    res = await extract_campaign_data(
        file_bytes=text.encode("utf-8"),
        filename="telegram_input",
        mime_type="text/plain"
    )
    print(res)

if __name__ == "__main__":
    asyncio.run(main())
