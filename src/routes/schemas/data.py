from pydantic import BaseModel
from typing import Optional

class ProcessRequest(BaseModel):
    file_id: Optional[str] = None  # None = process all files of the project
    chunk_size: Optional[int] = 100
    overlap_size: Optional[int] = 20
    do_reset: Optional[int] = 0
    
