from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import pandas as pd
import numpy as np
from store import data_store

router = APIRouter()

class FilterParams(BaseModel):
    session_id: str
    product_codes: Optional[List[str]] = None
    branches: Optional[List[str]] = None
    areas: Optional[List[str]] = None
    cities: Optional[List[str]] = None
    states: Optional[List[str]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

@router.post("/analysis/data")
async def get_analysis_data(filters: FilterParams):
    if filters.session_id not in data_store:
        raise HTTPException(status_code=404, detail="Session not found or expired. Please re-upload.")
        
    df = data_store[filters.session_id].copy()
    
    # Apply filters
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
        return {"summary": {}, "products": [], "trend": [], "matrix": {}}
        
    # --- Overall Summary ---
    total_qty = float(df["Quantity"].sum())
    total_sales = float(df["Sales Value"].sum())
    
    # Generate Month-on-Month Trend
    df['MonthYear'] = df['Date'].dt.to_period('M')
    trend_df = df.groupby('MonthYear').agg({"Quantity": "sum", "Sales Value": "sum"}).reset_index()
    trend_df['MonthYear'] = trend_df['MonthYear'].astype(str)
    trend = trend_df.to_dict(orient="records")

    # --- Product-wise Analysis ---
    product_stats = df.groupby(["Product Code", "Product Name"]).agg(
        total_qty=("Quantity", "sum"),
        total_sales=("Sales Value", "sum")
    ).reset_index()
    
    # ABC Analysis
    product_stats = product_stats.sort_values(by="total_sales", ascending=False)
    product_stats["cum_sales"] = product_stats["total_sales"].cumsum()
    product_stats["cum_pct"] = product_stats["cum_sales"] / total_sales
    
    def classify_abc(pct):
        if pct <= 0.80: return 'A'
        elif pct <= 0.95: return 'B'
        else: return 'C'
        
    product_stats["ABC_Class"] = product_stats["cum_pct"].apply(classify_abc)
    
    # XYZ Analysis & Velocity
    # Group by Product and Month
    monthly_product = df.groupby(["Product Code", "MonthYear"]).agg(
        monthly_qty=("Quantity", "sum")
    ).reset_index()
    
    xyz_stats = monthly_product.groupby("Product Code").agg(
        mean_qty=("monthly_qty", "mean"),
        std_qty=("monthly_qty", "std"),
        active_months=("MonthYear", "nunique")
    ).reset_index()
    
    xyz_stats["cov"] = xyz_stats["std_qty"] / xyz_stats["mean_qty"]
    xyz_stats["cov"] = xyz_stats["cov"].fillna(0) # For single month items
    
    def classify_xyz(cov):
        if cov <= 0.5: return 'X'
        elif cov <= 1.0: return 'Y'
        else: return 'Z'
        
    xyz_stats["XYZ_Class"] = xyz_stats["cov"].apply(classify_xyz)
    
    # Velocity (Fast, Medium, Slow, Non-moving)
    # Using relative mean_qty compared to category average
    cat_avg_qty = xyz_stats["mean_qty"].mean() if not xyz_stats.empty else 0
    
    def classify_velocity(row):
        if row["active_months"] == 0 or row["mean_qty"] == 0:
            return "Non-moving"
        elif row["mean_qty"] > cat_avg_qty * 1.5:
            return "Fast"
        elif row["mean_qty"] >= cat_avg_qty * 0.5:
            return "Medium"
        else:
            return "Slow"
            
    xyz_stats["Velocity"] = xyz_stats.apply(classify_velocity, axis=1)
    
    # Merge XYZ and ABC
    product_metrics = pd.merge(product_stats, xyz_stats, on="Product Code", how="left")
    product_metrics["Matrix"] = product_metrics["ABC_Class"] + product_metrics["XYZ_Class"]
    
    # Forecasting (3-month Moving Avg & Linear Trend)
    # We will do this per product, but for speed, let's only do it for products requested or top products
    # Actually, doing it for all products with numpy is fast enough for <10k rows
    
    forecasts = []
    for product_code, group in monthly_product.groupby("Product Code"):
        group = group.sort_values("MonthYear")
        history = group["monthly_qty"].values
        
        if len(history) < 3:
            forecasts.append({"Product Code": product_code, "Forecast_MA": None, "Forecast_Trend": None, "Message": "Insufficient data"})
            continue
            
        # 3-month moving average
        ma_3 = float(np.mean(history[-3:]))
        
        # Linear trend
        x = np.arange(len(history))
        y = history
        if len(x) > 1:
            slope, intercept = np.polyfit(x, y, 1)
            next_x = len(x)
            trend_val = max(0, float(slope * next_x + intercept)) # no negative forecasts
        else:
            trend_val = ma_3
            
        forecasts.append({"Product Code": product_code, "Forecast_MA": round(ma_3, 2), "Forecast_Trend": round(trend_val, 2), "Message": "Success"})
        
    forecast_df = pd.DataFrame(forecasts)
    if not forecast_df.empty:
        product_metrics = pd.merge(product_metrics, forecast_df, on="Product Code", how="left")
    else:
        product_metrics["Forecast_MA"] = None
        product_metrics["Forecast_Trend"] = None
        product_metrics["Message"] = "Insufficient data"
        
    # Replace NaN with None for JSON
    product_metrics = product_metrics.replace({np.nan: None})
    
    products_out = product_metrics.to_dict(orient="records")
    
    # Top Branch/State per product
    # We can calculate this on the fly or pre-calculate
    
    # Prepare matrix summary counts
    matrix_counts = product_metrics["Matrix"].value_counts().to_dict()
    
    return {
        "summary": {
            "total_qty": total_qty,
            "total_sales": total_sales,
            "total_products": len(product_metrics),
            "fast_movers": len(product_metrics[product_metrics["Velocity"] == "Fast"]),
            "slow_movers": len(product_metrics[product_metrics["Velocity"] == "Slow"]),
        },
        "trend": trend,
        "matrix_counts": matrix_counts,
        "products": products_out
    }
