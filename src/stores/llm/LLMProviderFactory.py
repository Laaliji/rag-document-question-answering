from .LLMEnums import LLMEnums
from .providers import OpenAICompatibleProvider
from helpers.config import Settings

class LLMProviderFactory:

    def __init__(self, config: Settings):
        self.config = config

    def create(self, provider: str):
        if provider == LLMEnums.OPENAI_COMPATIBLE.value:
            return OpenAICompatibleProvider(
                base_url=self.config.LLM_BASE_URL,
                api_key=self.config.LLM_API_KEY,
                default_max_output_tokens=self.config.GENERATION_DEFAULT_MAX_TOKENS,
                default_generation_temperature=self.config.GENERATION_DEFAULT_TEMPERATURE,
                document_prefix=self.config.EMBEDDING_DOCUMENT_PREFIX,
                query_prefix=self.config.EMBEDDING_QUERY_PREFIX,
            )

        return None
