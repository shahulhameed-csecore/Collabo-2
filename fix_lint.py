import os
import re

base_dir = r"c:\Users\shahu\Desktop\collabo-part-2 - Copy\influencertrack-frontend"

def replace_in_file(rel_path, replacements):
    path = os.path.join(base_dir, rel_path)
    if not os.path.exists(path):
        print(f"Not found: {path}")
        return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old, new in replacements:
        content = content.replace(old, new)
        
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated {rel_path}")

def regex_replace_in_file(rel_path, pattern, repl):
    path = os.path.join(base_dir, rel_path)
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = re.sub(pattern, repl, content)
        
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Regex Updated {rel_path}")

# api/extract/route.ts
replace_in_file("app/api/extract/route.ts", [("import { cookies } from 'next/headers';", "")])

# app/billing/page.tsx
replace_in_file("app/billing/page.tsx", [
    ("Shield, ", ""),
    ("import Link from 'next/link';", ""),
    ("} catch (err) {", "} catch (err: any) {")
])
regex_replace_in_file("app/billing/page.tsx", r"catch \(err\)", "catch (_err)")

# app/calendar/page.tsx
replace_in_file("app/calendar/page.tsx", [
    ("useMemo, ", ""),
    ("const parseLocalDate = (isoString: string) => {", "const _parseLocalDate = (isoString: string) => {")
])
regex_replace_in_file("app/calendar/page.tsx", r"const hasCampaignsThisMonth = [^\n]+", "")

# app/dashboard/analytics/page.tsx
replace_in_file("app/dashboard/analytics/page.tsx", [
    ("TrendingUp, ", "")
])
regex_replace_in_file("app/dashboard/analytics/page.tsx", r"const paidCampaigns = [^\n]+", "")

# app/dashboard/page.tsx
replace_in_file("app/dashboard/page.tsx", [("import dynamic from 'next/dynamic';", "")])

# app/error.tsx
replace_in_file("app/error.tsx", [("export default function Error({ error, reset }: { error: Error; reset: () => void })", "export default function Error({ reset }: { error: Error; reset: () => void })")])

# app/influencers/page.tsx
regex_replace_in_file("app/influencers/page.tsx", r"catch \(err\)", "catch (_err)")
replace_in_file("app/influencers/page.tsx", [("map((camp, idx)", "map((camp, _idx)")])

# app/settings/page.tsx
replace_in_file("app/settings/page.tsx", [("Save, ", ""), (", QrCode", "")])
regex_replace_in_file("app/settings/page.tsx", r"catch \(err\)", "catch (_err)")

# app/submit-proof/[token]/page.tsx
regex_replace_in_file("app/submit-proof/[token]/page.tsx", r"catch \(parseError\)", "catch (_parseError)")

# components/CampaignTable.tsx
replace_in_file("components/CampaignTable.tsx", [
    ("Plus, ", ""),
    ("Database, ", ""),
    ("import { PLATFORM_CONFIG } from '@/lib/types';", ""),
    ("const [openMenuId, setOpenMenuId] = useState<string | null>(null);", "")
])

# components/CreateCampaignModal.tsx
regex_replace_in_file("components/CreateCampaignModal.tsx", r"\}, \[file, supabase\]\);", "}, [file, supabase, pickFile]);")

# components/DashboardLayout.tsx
replace_in_file("components/DashboardLayout.tsx", [("Zap, ", ""), ("Bell, ", "")])

# components/DayViewModal.tsx
replace_in_file("components/DayViewModal.tsx", [("Clock, ", "")])

# components/NotificationDropdown.tsx
replace_in_file("components/NotificationDropdown.tsx", [("Sparkles, ", "")])

# components/ProfileDropdown.tsx
replace_in_file("components/ProfileDropdown.tsx", [("User, ", ""), (", ExternalLink", ""), ("tier,", "")])

# lib/api.ts
replace_in_file("lib/api.ts", [("import { toast } from 'sonner';", "")])

print("Done running lint fixes.")
