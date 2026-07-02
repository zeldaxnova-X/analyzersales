from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
import pandas as pd
import io
import json
from store import data_store, get_session_id

router = APIRouter()

@router.post("/upload/headers")
async def get_file_headers(file: UploadFile = File(...)):
    """Reads an uploaded file and returns its column headers."""
    filename = file.filename.lower()
    try:
        contents = await file.read()
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents), nrows=0)
        elif filename.endswith(".xlsx") or filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(contents), nrows=0)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload CSV or Excel.")
        
        return {"headers": df.columns.tolist()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

@router.post("/upload/process")
async def process_file(
    file: UploadFile = File(...), 
    mapping: str = Form(...) # JSON string representing the column mapping
):
    """Processes the uploaded file using the provided column mapping."""
    try:
        column_mapping = json.loads(mapping)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid mapping JSON.")

    filename = file.filename.lower()
    try:
        contents = await file.read()
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        elif filename.endswith(".xlsx") or filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format.")
            
        reverse_mapping = {v: k for k, v in column_mapping.items() if v}
        df = df.rename(columns=reverse_mapping)
        
        required_cols = ["Date", "Product Code", "Product Name", "Quantity", "Sales Value"]
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise HTTPException(status_code=400, detail=f"Missing mapped columns: {', '.join(missing_cols)}")

        validation_errors = []
        
        blank_codes = df["Product Code"].isna().sum()
        if blank_codes > 0:
            validation_errors.append(f"Found {blank_codes} rows with blank Product Codes.")
            
        df["Quantity"] = pd.to_numeric(df["Quantity"], errors="coerce").fillna(0)
        df["Sales Value"] = pd.to_numeric(df["Sales Value"], errors="coerce").fillna(0)
        
        neg_qty = (df["Quantity"] < 0).sum()
        neg_val = (df["Sales Value"] < 0).sum()
        
        if neg_qty > 0:
            validation_errors.append(f"Found {neg_qty} rows with negative Quantity.")
        if neg_val > 0:
            validation_errors.append(f"Found {neg_val} rows with negative Sales Value.")
            
        df = df.dropna(subset=["Product Code"])
        df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
        
        # Save to store
        session_id = get_session_id()
        data_store[session_id] = df
        
        # We can extract unique filter values to return to frontend
        unique_products = df[["Product Code", "Product Name"]].drop_duplicates().to_dict(orient="records")
        
        # Handle optional columns for filters
        branches = df["Branch"].dropna().unique().tolist() if "Branch" in df.columns else []
        areas = df["Area"].dropna().unique().tolist() if "Area" in df.columns else []
        cities = df["City"].dropna().unique().tolist() if "City" in df.columns else []
        states = df["State"].dropna().unique().tolist() if "State" in df.columns else []
        
        return {
            "message": "File processed successfully.",
            "session_id": session_id,
            "validation_warnings": validation_errors,
            "filters": {
                "products": unique_products,
                "branches": branches,
                "areas": areas,
                "cities": cities,
                "states": states,
                "min_date": df["Date"].min().strftime("%Y-%m-%d") if not pd.isna(df["Date"].min()) else None,
                "max_date": df["Date"].max().strftime("%Y-%m-%d") if not pd.isna(df["Date"].max()) else None
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")
