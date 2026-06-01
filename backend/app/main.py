import os
import time
import logging
from fastapi import FastAPI, Request, status, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError

from .config import settings
from .database import engine, Base, get_db
from .api.v1 import auth, users, tasks
from .schemas import SystemStatus

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("api_server.log")
    ]
)
logger = logging.getLogger(__name__)

# Initialize DB Tables (SQLite)
# In production, migrations (e.g., Alembic) should manage this
try:
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")
except Exception as e:
    logger.error(f"Error initializing database tables: {e}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="A secure REST API with Role-Based Access Control and full Task Management CRUD functionality.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For demo purposes. In production, list specific domains.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware for request logging and timing
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    formatted_process_time = f"{process_time:.2f}ms"
    logger.info(f"{request.method} {request.url.path} - Status: {response.status_code} - Completed in: {formatted_process_time}")
    return response

# Custom Global Error Handlers (Error handling and validation requirement)
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    logger.warning(f"HTTP Error: {exc.status_code} - {exc.detail} on {request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": exc.detail, "status_code": exc.status_code}
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation Error on {request.url.path}: {exc.errors()}")
    # Format a beautiful list of validation errors
    errors = []
    for err in exc.errors():
        field = " -> ".join(map(str, err.get("loc", [])))
        msg = err.get("msg")
        errors.append(f"Field '{field}': {msg}")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": "Validation Failed",
            "details": errors,
            "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY
        }
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.critical(f"Unhandled Exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": "An unexpected server error occurred. Please try again later.",
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR
        }
    )

# Include API Routers under /api/v1
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["Users"])
app.include_router(tasks.router, prefix=f"{settings.API_V1_STR}/tasks", tags=["Tasks/CRUD Entity"])

# Health Check Endpoint
@app.get(f"{settings.API_V1_STR}/status", response_model=SystemStatus, tags=["System Health"])
def system_status():
    """
    Check the health of the application and database.
    """
    db_status = "healthy"
    try:
        # Perform simple query to check DB availability
        with engine.connect() as conn:
            conn.execute(Base.metadata.tables["users"].select().limit(1))
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        db_status = "unhealthy"
        
    return {
        "status": "online",
        "database": db_status,
        "version": "1.0.0"
    }

# Create path directories for static assets if they don't exist yet
os.makedirs(os.path.join(os.path.dirname(__file__), "static"), exist_ok=True)
os.makedirs(os.path.join(os.path.dirname(__file__), "static", "css"), exist_ok=True)
os.makedirs(os.path.join(os.path.dirname(__file__), "static", "js"), exist_ok=True)

# Mount Static Files Directory
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")

# Catch-all Route to serve Frontend index.html
@app.get("/")
def read_root():
    """
    Serves the beautiful Single Page Application frontend.
    """
    index_path = os.path.join(os.path.dirname(__file__), "static", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return JSONResponse(
        content={"message": "FastAPI is running! The beautiful static frontend file 'index.html' is missing in 'static/' directory."}
    )
