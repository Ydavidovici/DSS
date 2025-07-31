from fastapi import FastAPI, Request
from starlette.staticfiles import StaticFiles
from starlette.templating import Jinja2Templates

from src.routers.statements import router as statements_router
from src.routers.transactions import router as transactions_router
from src.routers.budgets import router as budgets_router
from src.routers.reports import router as reports_router

app = FastAPI(
    title="PFM Service",
    description="Personal Finance Manager MVP",
    version="0.1.0"
)

# Mount static files and templates
tmpl_dir = "templates"
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory=tmpl_dir)

# Register routers
app.include_router(statements_router, prefix="/statements", tags=["statements"])
app.include_router(transactions_router, prefix="/transactions", tags=["transactions"])
app.include_router(budgets_router, prefix="/budgets", tags=["budgets"])
app.include_router(reports_router, prefix="/reports", tags=["reports"])

@app.get("/", include_in_schema=False)
async def home(request: Request):
    """
    Render the main dashboard page.
    """
    return templates.TemplateResponse("dashboard.html", {"request": request})
