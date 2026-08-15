from contextlib import asynccontextmanager
from fastapi import FastAPI
from routes import base, data
from motor.motor_asyncio import AsyncIOMotorClient
from helpers.config import get_settings, Settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    settings = get_settings()
    app.mongodb_client = AsyncIOMotorClient(settings.MONGODB_URL)
    app.db_client = app.mongodb_client[settings.MONGODB_DATABASE]

    yield  # app runs here

    # Shutdown
    app.mongodb_client.close()

app = FastAPI(lifespan=lifespan)

app.include_router(base.base_router)
app.include_router(data.data_router)