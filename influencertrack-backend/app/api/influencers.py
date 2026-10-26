import re
from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List, Optional
from datetime import datetime
from app.api.dependencies import get_current_user, get_user_supabase_client, AuthenticatedUser
from app.schemas.influencer import InfluencerResponse, InfluencerProfileUpdate
from app.core.limiter import limiter

router = APIRouter(prefix="/influencers", tags=["Influencers"])

def normalize_handle(handle: Optional[str], name: Optional[str]) -> str:
    """
    Normalizes a creator handle:
    - Strips leading '@', lowercases, and trims whitespace.
    - If handle is missing, 'n/a', 'none', 'unknown', or empty, fallbacks to slugifying influencer_name.
    """
    h = str(handle or "").strip().lower()
    if h.startswith("@"):
        h = h[1:].strip()
    
    if not h or h in ["n/a", "none", "unknown", "null", "undefined"]:
        n = str(name or "").strip().lower()
        if n and n not in ["unknown", "n/a", "none"]:
            slug = re.sub(r'[^\w]+', '_', n).strip('_')
            return slug if slug else "creator"
        return "creator"
    
    cleaned = re.sub(r'^[^\w]+', '', h)
    return cleaned if cleaned else h

def clean_platform_name(part: str) -> str:
    part_lower = part.strip().lower()
    mapping = {
        "youtube": "YouTube",
        "instagram": "Instagram",
        "twitter": "X",
        "x": "X",
        "tiktok": "TikTok",
        "linkedin": "LinkedIn",
        "facebook": "Facebook",
        "twitch": "Twitch",
    }
    return mapping.get(part_lower, part.strip().title())

@router.get("/", response_model=List[InfluencerResponse])
@limiter.limit("60/minute")
async def get_influencers(
    request: Request,
    client=Depends(get_user_supabase_client),
    user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        campaigns_response = await client.table("campaigns").select(
            "id, influencer_handle, influencer_name, platform, status, deadline, payment_amount"
        ).eq("user_id", user.user.id).execute()
        campaigns = campaigns_response.data if campaigns_response and hasattr(campaigns_response, 'data') else []
    except Exception as e:
        import structlog
        structlog.get_logger(__name__).error("influencers_campaigns_fetch_failed", error=str(e))
        campaigns = []

    # Group by normalized handle
    influencer_stats = {}
    for c in campaigns:
        raw_handle = c.get("influencer_handle")
        name = c.get("influencer_name")
        
        group_key = normalize_handle(raw_handle, name)
        
        if group_key not in influencer_stats:
            influencer_stats[group_key] = {
                "handle": group_key,
                "name": name,
                "platforms_set": set(),
                "total_campaigns": 0,
                "total_spend": 0.0,
                "resolved_campaigns": 0,
                "successful_campaigns": 0,
                "last_collaboration": None,
                "notes": None,
                "names_set": set()
            }
        
        stats = influencer_stats[group_key]
        stats["total_campaigns"] += 1
        
        # Aggregate spend
        try:
            amt = float(c.get("payment_amount") or 0.0)
            stats["total_spend"] += amt
        except (ValueError, TypeError):
            pass

        # Collect platforms
        raw_plat = c.get("platform")
        if raw_plat:
            for p in str(raw_plat).split(","):
                if p.strip():
                    stats["platforms_set"].add(clean_platform_name(p))
        
        if name and str(name).strip() and str(name).strip().lower() not in ["unknown", "n/a", "none"]:
            stats["names_set"].add(str(name).strip())
        
        # Track resolution & success
        status = c.get("status")
        if status in ["approved", "paid", "completed", "cancelled", "rejected"]:
            stats["resolved_campaigns"] += 1
            if status in ["approved", "paid", "completed"]:
                stats["successful_campaigns"] += 1
            
        deadline = c.get("deadline")
        if deadline:
            deadline_str = str(deadline)
            if not stats["last_collaboration"] or deadline_str > str(stats["last_collaboration"]):
                stats["last_collaboration"] = deadline_str

    try:
        from app.services.supabase import get_supabase_admin
        admin_client = await get_supabase_admin()
        profiles_response = await admin_client.table("influencer_profiles").select("*").eq("user_id", user.user.id).execute()
        profiles = profiles_response.data if profiles_response and hasattr(profiles_response, 'data') else []
    except Exception as e:
        import structlog
        structlog.get_logger(__name__).warning("influencers_profiles_fetch_failed", error=str(e))
        profiles = []
    
    # Merge profiles into stats
    for p in profiles:
        raw_h = p.get("handle")
        handle = normalize_handle(raw_h, p.get("name"))
        if handle in influencer_stats:
            if p.get("notes"):
                influencer_stats[handle]["notes"] = p.get("notes")
            if p.get("name"):
                influencer_stats[handle]["name"] = p.get("name")
            if p.get("platform"):
                for pt in str(p.get("platform")).split(","):
                    if pt.strip():
                        influencer_stats[handle]["platforms_set"].add(clean_platform_name(pt))
        else:
            platforms_set = set()
            if p.get("platform"):
                for pt in str(p.get("platform")).split(","):
                    if pt.strip():
                        platforms_set.add(clean_platform_name(pt))
            influencer_stats[handle] = {
                "handle": handle,
                "name": p.get("name"),
                "platforms_set": platforms_set,
                "total_campaigns": 0,
                "total_spend": 0.0,
                "resolved_campaigns": 0,
                "successful_campaigns": 0,
                "last_collaboration": None,
                "notes": p.get("notes")
            }

    # Format response
    response_data = []
    for stats in influencer_stats.values():
        if "names_set" in stats and stats["names_set"]:
            names_list = sorted(list(stats["names_set"]))
            stats["name"] = names_list[0] if len(names_list) == 1 else " / ".join(names_list)
            
        platform_str = ", ".join(sorted(stats["platforms_set"])) if stats.get("platforms_set") else None
            
        success_rate = (stats["successful_campaigns"] / stats["resolved_campaigns"]) * 100 if stats["resolved_campaigns"] > 0 else -1.0
        response_data.append(InfluencerResponse(
            handle=stats["handle"],
            name=stats["name"],
            platform=platform_str,
            notes=stats["notes"],
            total_campaigns=stats["total_campaigns"],
            total_spend=round(stats["total_spend"], 2),
            success_rate=round(success_rate, 2),
            last_collaboration=stats["last_collaboration"]
        ))
        
    return response_data

@router.patch("/{handle}", response_model=InfluencerResponse)
@limiter.limit("20/minute")
async def update_influencer_profile(
    handle: str,
    profile_update: InfluencerProfileUpdate,
    request: Request,
    client=Depends(get_user_supabase_client),
    user: AuthenticatedUser = Depends(get_current_user),
):
    data = profile_update.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields provided for update")
        
    normalized_handle = normalize_handle(handle, data.get("name"))
    upsert_data = {
        "user_id": user.user.id,
        "handle": normalized_handle,
        **data
    }
    try:
        from app.services.supabase import get_supabase_admin
        admin_client = await get_supabase_admin()
        response = await admin_client.table("influencer_profiles").upsert(upsert_data, on_conflict="user_id,handle").execute()
        result = response.data[0] if response.data else data
    except Exception as e:
        import structlog
        structlog.get_logger(__name__).error("influencers_profile_update_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to save profile: {str(e)}")

    return InfluencerResponse(
        handle=normalized_handle,
        name=result.get("name"),
        platform=result.get("platform"),
        notes=result.get("notes"),
        total_campaigns=0,
        total_spend=0.0,
        success_rate=0.0,
        last_collaboration=None
    )
