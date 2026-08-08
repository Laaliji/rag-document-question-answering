from enum import Enum

class ResponseSignal(Enum):
    
    ERROR = "error"
    NOT_FOUND = "not_found"
    FILE_TYPE_NOT_ALLOWED = "file_type_not_allowed"
    FILE_SIZE_EXCEEDED = "file_size_exceeded"
    FILE_UPLOAD_SUCCESS = "file_upload_success"
    FILE_UPLOAD_FAILURE = "file_upload_failure"
    FILE_VALIDATION_SUCCESS = "file_validation_success"
    FILE_VALIDATION_FAILURE = "file_validation_failure"
    FILE_PROCESSING_SUCCESS = "file_processing_success"
    FILE_PROCESSING_FAILURE = "file_processing_failure"
    
