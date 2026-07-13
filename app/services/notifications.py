import logging
from typing import Optional

logger = logging.getLogger(__name__)

async def create_notification(
    service_client, 
    user_id: str, 
    title: str, 
    message: str, 
    type: str = "info", 
    link_url: Optional[str] = None
) -> None:
    """
    Creates an in-app notification in Supabase.
    
    Args:
        service_client: An initialized Supabase client (preferably service role)
        user_id: The ID of the user receiving the notification
        title: Short title
        message: Detail text
        type: 'success', 'info', 'warning', or 'error'
        link_url: Optional URL to redirect to when clicked
    """
    try:
        data = {
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": type,
            "link_url": link_url,
            "is_read": False
        }
        resp = await service_client.table("notifications").insert(data).execute()
        
        if getattr(resp, "data", None):
            logger.info(f"Notification created for user {user_id}: {title}")
        else:
            logger.warning(f"Failed to create notification for user {user_id}. Response: {resp}")
            
    except Exception as e:
        logger.error(f"Error creating notification for user {user_id}: {str(e)}", exc_info=True)
