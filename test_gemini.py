import asyncio
import os
from app.services.gemini import extract_campaign_details
from PIL import Image

async def test():
    # create a dummy image
    img = Image.new('RGB', (100, 100), color = 'red')
    try:
        data = extract_campaign_details(img, "test.png")
        print("Success:", data)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(test())
