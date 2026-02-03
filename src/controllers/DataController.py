# DataController.py
from .BaseController import BaseController
from fastapi import UploadFile
import os
from models import ResponseSignal
from .ProjectController import ProjectController
import re  

class DataController(BaseController):
    def __init__(self):
        super().__init__()
        self.size_scale = 1048576  # Size scale to convert bytes to MB
    
    def validate_uploaded_file(self, file: UploadFile):
        allowed_extensions = self.app_settings.FILE_ALLOWED_TYPES
        max_size_mb = self.app_settings.FILE_MAX_SIZE_MB
        
        # check content type
        if file.content_type not in allowed_extensions:
            return False, ResponseSignal.FILE_TYPE_NOT_ALLOWED.value
        
        # get file size
        file.file.seek(0, os.SEEK_END)
        file_size = file.file.tell()
        file.file.seek(0)  # VERY IMPORTANT: reset pointer
        
        if file_size > max_size_mb * self.size_scale:
            return False, ResponseSignal.FILE_SIZE_EXCEEDED.value
        
        return True, ResponseSignal.FILE_VALIDATION_SUCCESS.value
    
    def generate_unique_filepath(self, original_filename: str, project_id: str):
        """Generate a unique filename to avoid collisions"""
        project_path = ProjectController().get_project_path(project_id=project_id)
        clean_filename = self.get_clean_filename(original_filename=original_filename)
        
        # Keep generating until we find a unique filename
        while True:
            random_key = self.generate_random_filename()
            new_filepath = os.path.join(project_path, f"{random_key}_{clean_filename}")
            
            if not os.path.exists(new_filepath):
                return new_filepath, random_key + "_" + clean_filename
    
    def get_clean_filename(self, original_filename: str):
        """Remove special characters and normalize filename"""
        # Remove any characters that aren't alphanumeric, dots, hyphens, or underscores
        clean_filename = re.sub(r'[^\w.\-]', '_', original_filename)
        # Replace multiple underscores with single underscore
        clean_filename = re.sub(r'_+', '_', clean_filename)
        # Remove leading/trailing underscores
        clean_filename = clean_filename.strip('_')
        
        return clean_filename