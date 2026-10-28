from abc import ABC, abstractmethod
from typing import List, Optional

class LLMInterface(ABC):

    @abstractmethod
    def set_generation_model(self, model_id: str):
        pass

    @abstractmethod
    def set_embedding_model(self, model_id: str, embedding_size: int):
        pass

    @abstractmethod
    async def generate_text(self, prompt: str, chat_history: list = [],
                            max_output_tokens: Optional[int] = None,
                            temperature: Optional[float] = None):
        pass

    @abstractmethod
    async def embed_text(self, texts: List[str], document_type: str):
        pass

    @abstractmethod
    def construct_prompt(self, prompt: str, role: str):
        pass
