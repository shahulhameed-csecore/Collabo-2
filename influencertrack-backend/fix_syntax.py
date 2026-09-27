import os

def fix_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Fix whatsapp decorator
    content = content.replace(
        '@router.post("/whatsapp")(request: Request, background_tasks: BackgroundTasks):',
        '@router.post("/whatsapp")\n@limiter.limit("60/minute")\nasync def meta_whatsapp_webhook(request: Request, background_tasks: BackgroundTasks):'
    )
    
    # Fix telegram decorator
    content = content.replace(
        '@router.post("/telegram")(request: Request, background_tasks: BackgroundTasks, x_telegram_bot_api_secret_token: str | None = Header(default=None)):',
        '@router.post("/telegram")\n@limiter.limit("60/minute")\nasync def telegram_webhook(request: Request, background_tasks: BackgroundTasks, x_telegram_bot_api_secret_token: str | None = Header(default=None)):'
    )
    
    content = content.replace(
        '@router.post("/telegram")(request: Request, \n    background_tasks: BackgroundTasks,\n    x_telegram_bot_api_secret_token: str | None = Header(default=None)\n):',
        '@router.post("/telegram")\n@limiter.limit("60/minute")\nasync def telegram_webhook(request: Request, background_tasks: BackgroundTasks, x_telegram_bot_api_secret_token: str | None = Header(default=None)):'
    )

    # Fix the raw newlines inside standard strings.
    # We will just replace all literal newlines inside standard strings.
    # The easiest hacky way for this specific issue is to replace `"` followed by a newline or text containing a newline before the closing `"` with triple quotes `"""`.
    # But since the strings are f-strings like f"📝 *Draft Saved*\n\nI'm missing...", we can just replace them.

    # Let's just fix the known broken blocks
    broken_blocks = [
        (
            '"👋 *Hi! I\'m Collabo AI.*\n\n"\n                "I noticed your WhatsApp number isn\'t linked to a Collabo account yet.\n\n"\n                "To start tracking campaigns automatically:\n"\n                "1. Go to your Collabo dashboard 👉 *Settings*.\n"\n                "2. Save this exact number.\n\n"\n                "Once linked, you can forward me chats or voice notes and I\'ll do the rest! ✨"',
            '("👋 *Hi! I\'m Collabo AI.*\\n\\n" "I noticed your WhatsApp number isn\'t linked to a Collabo account yet.\\n\\n" "To start tracking campaigns automatically:\\n" "1. Go to your Collabo dashboard 👉 *Settings*.\\n" "2. Save this exact number.\\n\\n" "Once linked, you can forward me chats or voice notes and I\'ll do the rest! ✨")'
        ),
        (
            '"👋 <b>Hi! I\'m Collabo AI.</b>\n\n"\n                "I noticed your Telegram account isn\'t linked to Collabo yet.\n\n"\n                "To start tracking campaigns automatically:\n"\n                f"1. Go to your dashboard 👉 <b>Settings</b>.\n"\n                f"2. Save your username <code>{html.escape(\'@\' + username) if username else \'YOUR_USERNAME\'}</code>.\n\n"\n                "Once linked, you can forward me chats and I\'ll do the rest! ✨"',
            '("👋 <b>Hi! I\'m Collabo AI.</b>\\n\\n" "I noticed your Telegram account isn\'t linked to Collabo yet.\\n\\n" "To start tracking campaigns automatically:\\n" f"1. Go to your dashboard 👉 <b>Settings</b>.\\n" f"2. Save your username <code>{html.escape(\'@\' + username) if username else \'YOUR_USERNAME\'}</code>.\\n\\n" "Once linked, you can forward me chats and I\'ll do the rest! ✨")'
        ),
        (
            'f"📝 *Draft Saved*\n\nI\'m missing some details:\n- {missing_str}\n\nWould you like to add them?"',
            'f"📝 *Draft Saved*\\n\\nI\'m missing some details:\\n- {missing_str}\\n\\nWould you like to add them?"'
        ),
        (
            '"🎉 *Campaign Created Successfully!*\n\nReply with *Activate* to make it live."',
            '"🎉 *Campaign Created Successfully!*\\n\\nReply with *Activate* to make it live."'
        ),
        (
            'f"📊 *Summary*\n\n{intent_res.recommendation_text or \'Here is the data.\'}"',
            'f"📊 *Summary*\\n\\n{intent_res.recommendation_text or \'Here is the data.\'}"'
        ),
        (
            'f"💡 *Suggestion*\n\n{intent_res.recommendation_text}"',
            'f"💡 *Suggestion*\\n\\n{intent_res.recommendation_text}"'
        ),
        (
            'f"📝 <b>Draft Saved</b>\n\nI\'m missing:\n- {missing_str}\n\nReply to update!"',
            'f"📝 <b>Draft Saved</b>\\n\\nI\'m missing:\\n- {missing_str}\\n\\nReply to update!"'
        ),
        (
            '"🎉 <b>Campaign Created!</b>"',
            '"🎉 <b>Campaign Created!</b>"'
        ),
        (
            'f"📊 <b>Summary</b>\n\n{intent_res.recommendation_text or \'Here is your data.\'}"',
            'f"📊 <b>Summary</b>\\n\\n{intent_res.recommendation_text or \'Here is your data.\'}"'
        ),
        (
            'f"💡 <b>Suggestion</b>\n\n{intent_res.recommendation_text}"',
            'f"💡 <b>Suggestion</b>\\n\\n{intent_res.recommendation_text}"'
        ),
        (
            '".replace("%", "\%").replace("_", "\_")',
            '".replace("%", "\\\\%").replace("_", "\\\\_")'
        )
    ]
    
    for bad, good in broken_blocks:
        content = content.replace(bad, good)
        
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

fix_file("app/api/whatsapp.py")
fix_file("app/api/telegram.py")
