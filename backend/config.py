import os

from dotenv import load_dotenv

load_dotenv()


class _Settings:
    """
    Fonte única de verdade para todas as variáveis de ambiente do backend.
    Leitura feita uma única vez na inicialização; valores imutáveis em runtime.
    LLM_API_KEY nunca deve aparecer em logs ou respostas de API.
    """

    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4o-mini")


settings = _Settings()
