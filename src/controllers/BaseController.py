# BaseController.py
from helpers.config import get_settings, Settings
import os
import random
import string

class BaseController:
    def __init__(self):
        self.app_settings: Settings = get_settings()
        self.base_dir = os.path.dirname(os.path.dirname(__file__))
        self.files_dir = os.path.join(self.base_dir, 'assets/files')
    
    def generate_random_filename(self, length: int = 12):
        """Generate a random filename with the given length"""
        return ''.join(random.choices(string.ascii_letters + string.digits, k=length))