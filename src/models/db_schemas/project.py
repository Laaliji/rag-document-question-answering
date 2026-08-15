from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from bson.objectid import ObjectId

class Project(BaseModel):
    _id: Optional[ObjectId]
    project_id: str = Field(..., min_length=1)

    @field_validator("project_id")
    @classmethod
    def validate_project_id(cls, value):
        if not value.isalnum():
            raise ValueError("Project ID must be alphanumeric.")
        return value

    class Config:  # Allow arbitrary types like ObjectId
        arbitrary_types_allowed = True