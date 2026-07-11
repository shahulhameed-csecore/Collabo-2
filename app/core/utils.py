

def get_valid_transitions() -> dict[str, list[str]]:
    """Defines the valid state transitions for campaigns."""
    return {
        "draft": ["active", "cancelled"],
        "active": ["cancelled"], # 'content_received' happens via file upload only
        "content_received": ["approved", "rejected", "cancelled"],
        "approved": ["paid", "cancelled"],
        "paid": ["cancelled"],
        "rejected": ["active", "cancelled", "approved", "content_received"], # allow restoring to active, or direct approval
        "cancelled": ["draft", "active"] # allow restoring from cancelled
    }

def handle_db_error(e: Exception, logger, context: str, user_id: str | None = None) -> None:
    """Parses database errors and raises appropriate HTTP exceptions."""
    from fastapi import HTTPException
    logger.error(context, error=type(e).__name__, detail=str(e), user_id=user_id)
    error_msg = str(e).lower()
    if "violates unique constraint" in error_msg and "short_code" in error_msg:
        raise HTTPException(status_code=400, detail="A tracking code conflict occurred. Please try again.")
    if "foreign key" in error_msg:
        raise HTTPException(status_code=400, detail="Invalid data reference. Make sure the linked data exists.")
    if "not-null" in error_msg:
        raise HTTPException(status_code=400, detail="Please fill in all required fields.")
    if "violates" in error_msg:
        raise HTTPException(status_code=400, detail="The provided data is invalid. Please double-check your inputs.")
    raise HTTPException(status_code=500, detail="An internal error occurred. Please try again or contact support if the issue persists.")
