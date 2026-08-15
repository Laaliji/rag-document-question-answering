from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from bson.objectid import ObjectId

class DataChunk(BaseModel):
    _id: Optional[ObjectId]
    chunk_project_id: ObjectId
    chunk_text: str = Field(..., min_length=1)
    chunk_metadata: Optional[dict]
    chunk_order: Optional[int] = Field(..., gt=0)  # Ensure chunk_order is non-negative

    @field_validator("chunk_project_id", "chunk_text")
    @classmethod
    def validate_ids(cls, value):
        if not value.isalnum():
            raise ValueError("IDs must be alphanumeric.")
        return value

    class Config:
        arbitrary_types_allowed = True