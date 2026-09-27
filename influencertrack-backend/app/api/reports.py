import calendar
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from app.api.dependencies import get_current_user, AuthenticatedUser
from app.services.reports import fetch_monthly_metrics, generate_pdf_report, generate_excel_report
from app.core.limiter import limiter
from fastapi import Request

router = APIRouter(prefix="/campaigns/reports", tags=["Reports"])

@router.get("/monthly")
@limiter.limit("10/minute")
async def get_monthly_report(
    request: Request,
    month: str = Query(..., description="Month in YYYY-MM format"),
    format: str = Query("pdf", description="Format of the report: 'pdf' or 'excel'"),
    user: AuthenticatedUser = Depends(get_current_user)
):
    try:
        dt = datetime.strptime(month, "%Y-%m")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")
    
    # Calculate start and end date strings for the query
    _, last_day = calendar.monthrange(dt.year, dt.month)
    start_date = f"{dt.year}-{dt.month:02d}-01"
    end_date = f"{dt.year}-{dt.month:02d}-{last_day:02d}"
    month_str = dt.strftime("%B %Y")
    
    # Fetch data
    metrics = await fetch_monthly_metrics(user.user.id, start_date, end_date)
    
    if metrics["total_campaigns_in_period"] == 0:
        raise HTTPException(status_code=404, detail=f"No campaigns found for {month_str}")
        
    if format.lower() == "pdf":
        pdf_bytes = generate_pdf_report(metrics, month_str)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="Report_{month}.pdf"'}
        )
    elif format.lower() == "excel":
        excel_bytes = generate_excel_report(metrics, month_str)
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="Report_{month}.xlsx"'}
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid format. Use 'pdf' or 'excel'.")
