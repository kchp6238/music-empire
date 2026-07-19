from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import UserCreate, UserOut, Token
from app.services.auth_service import hash_password, verify_password, create_access_token
from app.services import rate_limit

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_key(request: Request, prefix: str) -> str:
    return f"{prefix}:{request.client.host if request.client else 'unknown'}"


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, request: Request, db: Session = Depends(get_db)):
    if not rate_limit.check(_client_key(request, "register"), limit=5, window_sec=3600):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="가입 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.")

    # Invite gate: when INVITE_CODES is configured, registration is closed to
    # anyone without a code. Empty means open (local dev default).
    codes = settings.invite_code_set
    if codes and (payload.invite_code or "").strip() not in codes:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="초대 코드가 올바르지 않습니다.")

    if len(payload.password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="비밀번호는 8자 이상이어야 합니다.")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 가입된 이메일입니다.")

    user = User(email=payload.email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    if not rate_limit.check(_client_key(request, "login"), limit=10, window_sec=300):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.")

    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
    return Token(access_token=create_access_token(user.id))


@router.get("/config")
def auth_config():
    """Lets the sign-up form know whether to ask for an invite code."""
    return {"invite_required": bool(settings.invite_code_set)}
