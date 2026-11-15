from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, computed_field
import uuid

GUEST_EMAIL_DOMAIN = "@guest.chesslens-app.com"


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    chesscom_username: Optional[str] = None


class UserOut(UserBase):
    id: uuid.UUID
    avatar_url: Optional[str] = None
    is_active: bool
    is_verified: bool
    chesscom_username: Optional[str] = None
    created_at: datetime

    @computed_field
    @property
    def is_guest(self) -> bool:
        return self.email.endswith(GUEST_EMAIL_DOMAIN)

    class Config:
        from_attributes = True


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    refresh_token: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
