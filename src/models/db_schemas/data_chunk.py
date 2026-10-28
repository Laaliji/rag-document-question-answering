from pydantic import BaseModel, Field
from typing import Optional
from bson.objectid import ObjectId

class DataChunk(BaseModel):
    id: Optional[ObjectId] = Field(None, alias="_id")
    chunk_project_id: ObjectId
    chunk_asset_id: ObjectId  # the file (asset) this chunk comes from
    chunk_text: str = Field(..., min_length=1)
    chunk_metadata: dict = Field(default_factory=dict)
    chunk_order: int = Field(..., gt=0)  # Ensure chunk_order is positive (starts at 1)

    class Config:
        arbitrary_types_allowed = True
        populate_by_name = True
