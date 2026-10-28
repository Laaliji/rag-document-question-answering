from ..LLMInterface import LLMInterface
from ..LLMEnums import OpenAIRoleEnums, DocumentTypeEnum
from openai import AsyncOpenAI
from typing import List, Optional
import logging

class OpenAICompatibleProvider(LLMInterface):

    def __init__(self, base_url: str, api_key: str,
                 default_max_output_tokens: int = 1000,
                 default_generation_temperature: float = 0.1,
                 document_prefix: str = "", query_prefix: str = ""):

        self.default_max_output_tokens = default_max_output_tokens
        self.default_generation_temperature = default_generation_temperature

        # Some embedding models (e.g. nomic-embed-text) expect a task prefix on each text
        self.prefixes = {
            DocumentTypeEnum.DOCUMENT.value: document_prefix,
            DocumentTypeEnum.QUERY.value: query_prefix,
        }

        self.generation_model_id = None
        self.embedding_model_id = None
        self.embedding_size = None

        self.client = AsyncOpenAI(base_url=base_url, api_key=api_key)
        self.logger = logging.getLogger("uvicorn.error")

    def set_generation_model(self, model_id: str):
        self.generation_model_id = model_id

    def set_embedding_model(self, model_id: str, embedding_size: int):
        self.embedding_model_id = model_id
        self.embedding_size = embedding_size

    async def generate_text(self, prompt: str, chat_history: list = [],
                            max_output_tokens: Optional[int] = None,
                            temperature: Optional[float] = None):

        if not self.generation_model_id:
            self.logger.error("Generation model is not set")
            return None

        messages = chat_history + [self.construct_prompt(prompt=prompt, role=OpenAIRoleEnums.USER.value)]

        response = await self.client.chat.completions.create(
            model=self.generation_model_id,
            messages=messages,
            max_tokens=max_output_tokens or self.default_max_output_tokens,
            temperature=temperature if temperature is not None else self.default_generation_temperature,
        )

        if not response or not response.choices:
            self.logger.error("Error while generating text")
            return None

        return response.choices[0].message.content

    async def embed_text(self, texts: List[str], document_type: str):
        """Embed a batch of texts, returns one vector per text (same order)"""

        if not self.embedding_model_id:
            self.logger.error("Embedding model is not set")
            return None

        prefix = self.prefixes.get(document_type, "")
        response = await self.client.embeddings.create(
            model=self.embedding_model_id,
            input=[prefix + text for text in texts],
        )

        if not response or not response.data:
            self.logger.error("Error while embedding text")
            return None

        return [record.embedding for record in response.data]

    def construct_prompt(self, prompt: str, role: str):
        return {"role": role, "content": prompt}
