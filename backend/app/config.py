from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/auth/google/callback"

    ANTHROPIC_API_KEY: str

    STOCKFISH_PATH: str = "/usr/local/bin/stockfish"
    STOCKFISH_DEPTH: int = 18
    STOCKFISH_BULK_DEPTH: int = 5

    CHESSCOM_BASE_URL: str = "https://api.chess.com/pub"

    APP_ENV: str = "development"
    FRONTEND_URL: str = "http://localhost:5173"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
