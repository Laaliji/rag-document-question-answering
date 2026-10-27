from contextlib import asynccontextmanager
from fastapi import FastAPI
from routes import base, data
from motor.motor_asyncio import AsyncIOMotorClient
from helpers.config import get_settings, Settings
from models import ProjectModel, ChunkModel

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    settings = get_settings()
    app.mongodb_client = AsyncIOMotorClient(settings.MONGODB_URL)
    app.db_client = app.mongodb_client[settings.MONGODB_DATABASE]

    # Create collection indexes (safe to run on every startup)
    await ProjectModel(db_client=app.db_client).init_collection()
    await ChunkModel(db_client=app.db_client).init_collection()

    yield  # app runs here

    # Shutdown
    app.mongodb_client.close()

app = FastAPI(lifespan=lifespan)

app.include_router(base.base_router)
app.include_router(data.data_router)