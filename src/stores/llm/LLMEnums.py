from enum import Enum

class LLMEnums(Enum):

    # Any server that speaks the OpenAI API: Ollama, Groq, OpenAI, LM Studio...
    OPENAI_COMPATIBLE = "OPENAI_COMPATIBLE"

class OpenAIRoleEnums(Enum):

    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"

class DocumentTypeEnum(Enum):

    DOCUMENT = "document"  # chunks stored in the vector DB
    QUERY = "query"        # user questions used for search
