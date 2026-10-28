from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import List, Optional
from functools import lru_cache

class Settings(BaseSettings):
    APP_NAME: str
    APP_VERSION: str
    OPENAI_API_KEY: Optional[str] = None  # only needed if LLM_BASE_URL points to OpenAI
    FILE_ALLOWED_TYPES: List[str] = Field(default_factory=list)
    FILE_MAX_SIZE_MB: int 
    FILE_DEFAULT_CHUNK_SIZE: int
    MONGODB_URL: str
    MONGODB_DATABASE: str

    LLM_BACKEND: str
    LLM_BASE_URL: str
    LLM_API_KEY: str

    EMBEDDING_MODEL_ID: str
    EMBEDDING_MODEL_SIZE: int
    EMBEDDING_DOCUMENT_PREFIX: str = ""
    EMBEDDING_QUERY_PREFIX: str = ""

    GENERATION_MODEL_ID: str
    GENERATION_DEFAULT_MAX_TOKENS: int = 1000
    GENERATION_DEFAULT_TEMPERATURE: float = 0.1

    VECTOR_DB_BACKEND: str
    VECTOR_DB_URL: str
    VECTOR_DB_DISTANCE_METHOD: str = "cosine"
    


    class Config:
        env_file = ".env"

@lru_cache  # read .env once, reuse the same Settings object
def get_settings():
    return Settings()
