from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
import os
import tempfile
from store import data_store
from routers.analysis import FilterParams

router = APIRouter()

@router.post("/export/excel")
async def export_excel(filters: FilterParams):
    if filters.session_id not in data_store:
        raise HTTPException(status_code=404, detail="Session not found or expired. Please re-upload.")
        
    df = data_store[filters.session_id].copy()
    
    # Apply filters (same logic as analysis, in a real app this would be a shared function)
    if filters.product_codes:
        df = df[df["Product Code"].isin(filters.product_codes)]
    if filters.branches and "Branch" in df.columns:
        df = df[df["Branch"].isin(filters.branches)]
    if filters.areas and "Area" in df.columns:
        df = df[df["Area"].isin(filters.areas)]
    if filters.cities and "City" in df.columns:
        df = df[df["City"].isin(filters.cities)]
    if filters.states and "State" in df.columns:
        df = df[df["State"].isin(filters.states)]
    if filters.start_date:
        df = df[df["Date"] >= pd.to_datetime(filters.start_date)]
    if filters.end_date:
        df = df[df["Date"] <= pd.to_datetime(filters.end_date)]
        
    if df.empty:
        raise HTTPException(status_code=400, detail="No data available for export with current filters.")
        
    # We could re-run the analysis to get ABC/XYZ metrics, or the frontend could just post the metrics JSON back.
    # To keep it robust, the backend will recalculate it or we import the logic.
    # Since this is a quick build, I will do a quick aggregation here.
    
    product_stats = df.groupby(["Product Code", "Product Name"]).agg(
        total_qty=("Quantity", "sum"),
        total_sales=("Sales Value", "sum")
    ).reset_index()
    
    # Save to temp file
    fd, path = tempfile.mkstemp(suffix=".xlsx")
    with os.fdopen(fd, 'w') as f:
        pass # just to ensure file exists and is closed properly
        
    # Write using pandas
    with pd.ExcelWriter(path, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name="Raw Data", index=False)
        product_stats.to_excel(writer, sheet_name="Product Summary", index=False)
        
    # Return file response (in production we'd use BackgroundTasks to delete the file later)
    return FileResponse(path, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename="Sales_Analysis_Report.xlsx")
