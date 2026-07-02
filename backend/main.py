from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.upload import router as upload_router
from routers.analysis import router as analysis_router
from routers.export import router as export_router

app = FastAPI(title="Sales Data Analyzer API")

# Setup CORS to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Usually restricts this to the frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router, prefix="/api")
app.include_router(analysis_router, prefix="/api")
app.include_router(export_router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Welcome to the Sales Data Analyzer API"}
