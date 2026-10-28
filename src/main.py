from contextlib import asynccontextmanager
from fastapi import FastAPI
from routes import base, data, nlp
from motor.motor_asyncio import AsyncIOMotorClient
from helpers.config import get_settings, Settings
from models import ProjectModel, ChunkModel, AssetModel
from stores.llm import LLMProviderFactory
from stores.vectordb import VectorDBProviderFactory

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    settings = get_settings()
    app.mongodb_client = AsyncIOMotorClient(settings.MONGODB_URL)
    app.db_client = app.mongodb_client[settings.MONGODB_DATABASE]

    # Create collection indexes (safe to run on every startup)
    await ProjectModel(db_client=app.db_client).init_collection()
    await ChunkModel(db_client=app.db_client).init_collection()
    await AssetModel(db_client=app.db_client).init_collection()

    # LLM clients (embedding and generation can use different models)
    llm_provider_factory = LLMProviderFactory(settings)

    app.embedding_client = llm_provider_factory.create(provider=settings.LLM_BACKEND)
    app.embedding_client.set_embedding_model(model_id=settings.EMBEDDING_MODEL_ID,
                                             embedding_size=settings.EMBEDDING_MODEL_SIZE)

    app.generation_client = llm_provider_factory.create(provider=settings.LLM_BACKEND)
    app.generation_client.set_generation_model(model_id=settings.GENERATION_MODEL_ID)

    # Vector DB client
    app.vectordb_client = VectorDBProviderFactory(settings).create(provider=settings.VECTOR_DB_BACKEND)
    await app.vectordb_client.connect()

    yield  # app runs here

    # Shutdown
    app.mongodb_client.close()
    await app.vectordb_client.disconnect()

app = FastAPI(lifespan=lifespan)

app.include_router(base.base_router)
app.include_router(data.data_router)
app.include_router(nlp.nlp_router)