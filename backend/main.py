from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routers import requests, lots, auth, users, messages

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Parking Management API",
    description="REST API for the parking management mockup",
    version="2.0.0",
)

# Allow the React dev server (port 3000) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(requests.router)
app.include_router(messages.router)
app.include_router(lots.router)
app.include_router(users.router)


@app.get("/")
def root():
    return {"status": "ok", "message": "Parking Management API v2"}
