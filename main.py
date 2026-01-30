from fastapi import FastAPI
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent / ".env")

from routes import base

app = FastAPI()
app.include_router(base.base_router)
