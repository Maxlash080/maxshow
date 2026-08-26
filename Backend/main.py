import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import urllib.error
import urllib.request
from datetime import datetime
from uuid import uuid4
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Generator

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, create_engine, func, inspect, or_, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker



import smtplib
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "Frontend"
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL") or f"sqlite:///{BASE_DIR / 'maxshow.db'}"

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "rzp_test_TTFGH3rlszmUAE")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "TvZQuF9gPM43IuSnxt7UFkk3")

# Gmail SMTP Configuration for OTP Delivery
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER", "official.maxshow@gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "cbnbbcisclsagrfi")
SMTP_FROM_NAME = "MAXSHOW Events"

# In-memory store for verification codes: clean_email -> {"otp": str, "expires_at": float, "verified": bool}
otp_cache: dict[str, dict] = {}


def send_otp_email(to_email: str, otp_code: str) -> bool:
    subject = f"{otp_code} is your MAXSHOW verification code"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FFF9F2; margin: 0; padding: 24px; color: #17202A;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 24px; padding: 36px 28px; border: 1px solid #e7e5e4; box-shadow: 0 4px 20px rgba(0,0,0,0.04);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
          <div style="width: 42px; height: 42px; border-radius: 14px; background: #F2634E; color: #ffffff; font-size: 22px; font-weight: 900; line-height: 42px; text-align: center;">M</div>
          <span style="font-size: 20px; font-weight: 900; letter-spacing: -0.5px; color: #17202A;">MAXSHOW</span>
        </div>
        <h2 style="font-size: 22px; font-weight: 900; color: #17202A; margin: 0 0 10px;">Verify your email address</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #64748b; margin: 0 0 24px;">
          Use the 6-digit verification code below to complete creating your MAXSHOW account.
        </p>
        <div style="background: #FFF2EE; border: 2px dashed #F2634E; border-radius: 18px; padding: 20px; text-align: center; margin: 0 0 24px;">
          <span style="font-family: monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #F2634E;">{otp_code}</span>
        </div>
        <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
          ⏰ This code will expire in <strong>5 minutes</strong>.<br>
          If you didn't request this verification code, you can safely ignore this email.
        </p>
      </div>
    </body>
    </html>
    """

    text_body = f"Your MAXSHOW verification code is: {otp_code}. It will expire in 5 minutes."

    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "official.maxshow@gmail.com").strip()
    smtp_pwd = os.getenv("SMTP_PASSWORD", "cbnbbcisclsagrfi").replace(" ", "").strip()

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{SMTP_FROM_NAME} <{smtp_user}>"
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    # Try 1: Port 587 with STARTTLS
    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=8) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_pwd)
            server.sendmail(smtp_user, [to_email], msg.as_string())
        print(f"[OTP EMAIL SENT (587)] Successfully sent OTP {otp_code} to {to_email}")
        return True
    except Exception as e1:
        print(f"[OTP EMAIL 587 FAILED] ({type(e1).__name__}: {e1}). Trying SSL port 465...")

    # Try 2: Port 465 with direct SSL
    try:
        with smtplib.SMTP_SSL(smtp_host, 465, timeout=8) as server:
            server.ehlo()
            server.login(smtp_user, smtp_pwd)
            server.sendmail(smtp_user, [to_email], msg.as_string())
        print(f"[OTP EMAIL SENT (465)] Successfully sent OTP {otp_code} to {to_email}")
        return True
    except Exception as e2:
        print(f"[OTP EMAIL 465 FAILED] ({type(e2).__name__}: {e2}). Generated OTP for {to_email}: {otp_code}")

    return False

connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 600_000)
    return "pbkdf2_sha256$600000${}${}".format(
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt_value, digest_value = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_value)
        expected_digest = base64.b64decode(digest_value)
        calculated_digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, int(iterations)
        )
        return hmac.compare_digest(calculated_digest, expected_digest)
    except (ValueError, TypeError):
        return False


def generate_user_custom_id(full_name: str, phone: str) -> str:
    """Format: 5 characters of full name + 4 starting digits of phone number."""
    clean_name = "".join(c for c in full_name if c.isalnum()).upper()
    name_part = clean_name[:5] if len(clean_name) >= 5 else clean_name.ljust(5, "X")
    clean_phone = "".join(c for c in phone if c.isdigit())
    phone_part = clean_phone[:4] if len(clean_phone) >= 4 else clean_phone.ljust(4, "0")
    return f"{name_part}{phone_part}"


def generate_event_custom_id(title: str, event_time_or_date: str) -> str:
    """Format: First 5 characters of event name + date."""
    clean_title = "".join(c for c in title if c.isalnum()).upper()
    name_part = clean_title[:5] if len(clean_title) >= 5 else clean_title.ljust(5, "X")
    digits = "".join(c for c in event_time_or_date if c.isdigit())
    date_part = digits[:8] if len(digits) >= 8 else datetime.now().strftime("%Y%m%d")
    return f"{name_part}{date_part}"


def generate_booking_custom_id(user_custom_id: str, event_custom_id: str, suffix: str = "") -> str:
    """Format: User ID first 5 characters + Event ID first 5 characters (+ unique suffix)."""
    u_part = (user_custom_id or "USERX")[:5].upper().ljust(5, "X")
    e_part = (event_custom_id or "EVENT")[:5].upper().ljust(5, "X")
    sfx = suffix or secrets.token_hex(2).upper()
    return f"{u_part}-{e_part}-{sfx}"


def generate_user_username(full_name: str, phone_number: str = "") -> str:
    """Generates a default alphanumeric username for existing users."""
    base = re.sub(r"[^a-zA-Z0-9_]", "", full_name.lower().replace(" ", "_")).strip("_")
    if not base or len(base) < 2:
        base = "user"
    digits = "".join(c for c in phone_number if c.isdigit())[-4:] if phone_number else secrets.token_hex(2)
    return f"{base}_{digits}"


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    custom_id: Mapped[str | None] = mapped_column(String(50), unique=True, index=True, nullable=True)
    username: Mapped[str | None] = mapped_column(String(60), unique=True, index=True, nullable=True)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=False, nullable=False, index=True)
    phone_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="user", cascade="all, delete-orphan")


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    custom_id: Mapped[str | None] = mapped_column(String(50), unique=True, index=True, nullable=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    venue: Mapped[str] = mapped_column(String(160), nullable=False)
    time: Mapped[str] = mapped_column(String(100), nullable=False)
    location: Mapped[str] = mapped_column(String(160), nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    image: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Text] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    day: Mapped[str] = mapped_column(String(20), nullable=False, default="weekend")
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="event")


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    custom_id: Mapped[str | None] = mapped_column(String(60), unique=True, index=True, nullable=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id", ondelete="SET NULL"), nullable=True, index=True)
    event_title: Mapped[str] = mapped_column(String(160), nullable=False)
    event_location: Mapped[str] = mapped_column(String(160), nullable=False)
    event_time: Mapped[str] = mapped_column(String(100), nullable=False)
    ticket_count: Mapped[int] = mapped_column(Integer, nullable=False)
    total_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    payment_status: Mapped[str] = mapped_column(String(40), nullable=False, default="Paid (Razorpay)")
    payment_id: Mapped[str | None] = mapped_column(String(100), nullable=True, default=None)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="bookings")
    event: Mapped["Event | None"] = relationship("Event", back_populates="bookings")


class SendOtpRequest(BaseModel):
    email: str = Field(min_length=3, max_length=150)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", clean):
            raise ValueError("Please enter a valid email address.")
        return clean


class VerifyOtpRequest(BaseModel):
    email: str = Field(min_length=3, max_length=150)
    otp: str = Field(min_length=6, max_length=6)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", clean):
            raise ValueError("Please enter a valid email address.")
        return clean

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, v: str) -> str:
        clean = v.strip()
        if not clean.isdigit() or len(clean) != 6:
            raise ValueError("OTP must be a 6-digit numeric code.")
        return clean


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    username: str = Field(min_length=3, max_length=30)
    email: str = Field(min_length=3, max_length=150)
    mobile: str = Field(min_length=10, max_length=15)
    password: str = Field(min_length=6, max_length=128)
    otp: str = Field(default="", max_length=10)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Full name cannot be empty.")
        if any(char.isdigit() for char in clean):
            raise ValueError("Full name must contain letters only (numbers are not allowed).")
        if not re.match(r"^[A-Za-z\s.'-]+$", clean):
            raise ValueError("Full name must contain letters and spaces only.")
        return clean

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        clean = v.strip().lower()
        if not clean:
            raise ValueError("Username cannot be empty.")
        if len(clean) < 3 or len(clean) > 30:
            raise ValueError("Username must be between 3 and 30 characters.")
        if not re.match(r"^[a-z0-9_]+$", clean):
            raise ValueError("Username can only contain letters, numbers, and underscores (_) with no spaces or special symbols.")
        return clean

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, v: str) -> str:
        clean = v.strip()
        if not clean.isdigit():
            raise ValueError("Mobile number must contain numbers only (letters are not allowed).")
        if len(clean) != 10:
            raise ValueError("Mobile number must be a valid 10-digit number.")
        return clean

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", clean):
            raise ValueError("Please enter a valid email address.")
        return clean


class UpdateProfileRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    username: str = Field(min_length=3, max_length=30)
    email: str = Field(min_length=3, max_length=150)
    mobile: str = Field(min_length=10, max_length=15)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Full name cannot be empty.")
        if any(char.isdigit() for char in clean):
            raise ValueError("Full name must contain letters only (numbers are not allowed).")
        if not re.match(r"^[A-Za-z\s.'-]+$", clean):
            raise ValueError("Full name must contain letters and spaces only.")
        return clean

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        clean = v.strip().lower()
        if not clean:
            raise ValueError("Username cannot be empty.")
        if len(clean) < 3 or len(clean) > 30:
            raise ValueError("Username must be between 3 and 30 characters.")
        if not re.match(r"^[a-z0-9_]+$", clean):
            raise ValueError("Username can only contain letters, numbers, and underscores (_) with no spaces or special symbols.")
        return clean

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, v: str) -> str:
        clean = v.strip()
        if not clean.isdigit():
            raise ValueError("Mobile number must contain numbers only (letters are not allowed).")
        if len(clean) != 10:
            raise ValueError("Mobile number must be a valid 10-digit number.")
        return clean

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", clean):
            raise ValueError("Please enter a valid email address.")
        return clean


class LoginRequest(BaseModel):
    email: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_login_identifier(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Please enter your email address or username.")
        return clean


class AdminLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Username cannot be empty.")
        return clean


class ImageUploadRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=50)
    data: str = Field(min_length=1)


class EventRequest(BaseModel):
    slug: str = Field(min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$")
    title: str = Field(min_length=2, max_length=160)
    event_type: str = Field(min_length=2, max_length=80)
    venue: str = Field(min_length=2, max_length=160)
    time: str = Field(min_length=2, max_length=100)
    location: str = Field(min_length=2, max_length=160)
    price: int = Field(ge=0)
    image: str = Field(min_length=5, max_length=500)
    description: str = Field(min_length=2, max_length=2000)
    category: str = Field(min_length=2, max_length=50)
    day: str = Field(min_length=2, max_length=20)


class CreatePaymentOrderRequest(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    location: str = Field(min_length=2, max_length=160)
    time: str = Field(min_length=2, max_length=100)
    price: int = Field(ge=0)
    quantity: int = Field(ge=1, le=20)
    event_id: int | None = None
    event_slug: str | None = None


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str = Field(min_length=1)
    razorpay_payment_id: str = Field(min_length=1)
    razorpay_signature: str = Field(min_length=1)
    title: str = Field(min_length=2, max_length=160)
    location: str = Field(min_length=2, max_length=160)
    time: str = Field(min_length=2, max_length=100)
    price: int = Field(ge=0)
    quantity: int = Field(ge=1, le=20)
    event_id: int | None = None
    event_slug: str | None = None


def resolve_event(db: Session, event_id: int | None, event_slug: str | None, title: str) -> Event | None:
    if event_id:
        ev = db.get(Event, event_id)
        if ev:
            return ev
    if event_slug:
        ev = db.query(Event).filter(Event.slug == event_slug.strip()).first()
        if ev:
            return ev
    clean_title = title.lower().strip()
    ev = db.query(Event).filter(func.lower(Event.title) == clean_title).first()
    if ev:
        return ev
    return db.query(Event).filter(Event.title.ilike(f"%{clean_title[:20]}%")).first()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    try:
        insp = inspect(engine)
        tables = set(insp.get_table_names())
        with engine.connect() as conn:
            if "users" in tables:
                u_cols = {c["name"] for c in insp.get_columns("users")}
                if "custom_id" not in u_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN custom_id VARCHAR(50) NULL"))
                    conn.commit()
                if "username" not in u_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN username VARCHAR(60) NULL"))
                    conn.commit()

            if "events" in tables:
                e_cols = {c["name"] for c in insp.get_columns("events")}
                if "custom_id" not in e_cols:
                    conn.execute(text("ALTER TABLE events ADD COLUMN custom_id VARCHAR(50) NULL"))
                    conn.commit()

            if "bookings" in tables:
                b_cols = {c["name"] for c in insp.get_columns("bookings")}
                if "custom_id" not in b_cols:
                    conn.execute(text("ALTER TABLE bookings ADD COLUMN custom_id VARCHAR(60) NULL"))
                    conn.commit()
                if "event_id" not in b_cols:
                    conn.execute(text("ALTER TABLE bookings ADD COLUMN event_id INT NULL"))
                    conn.commit()
                if "payment_status" not in b_cols:
                    conn.execute(
                        text("ALTER TABLE bookings ADD COLUMN payment_status VARCHAR(40) NOT NULL DEFAULT 'Paid (Razorpay)'")
                    )
                    conn.commit()
                if "payment_id" not in b_cols:
                    conn.execute(
                        text("ALTER TABLE bookings ADD COLUMN payment_id VARCHAR(100) NULL DEFAULT NULL")
                    )
                    conn.commit()

        # Backfill existing data
        with SessionLocal() as db:
            for u in db.query(User).filter((User.custom_id == None) | (User.custom_id == "")).all():
                u.custom_id = generate_user_custom_id(u.full_name, u.phone_number)

            for u in db.query(User).filter((User.username == None) | (User.username == "")).all():
                base_uname = generate_user_username(u.full_name, u.phone_number)
                candidate = base_uname
                cnt = 1
                while db.query(User).filter(func.lower(User.username) == candidate.lower(), User.id != u.id).first():
                    candidate = f"{base_uname}_{cnt}"
                    cnt += 1
                u.username = candidate

            events_list = db.query(Event).all()
            event_title_map = {}
            for e in events_list:
                if not e.custom_id:
                    e.custom_id = generate_event_custom_id(e.title, e.time)
                event_title_map[e.title.lower().strip()] = e

            db.commit()

            for b in db.query(Booking).all():
                matched_event = None
                if not b.event_id:
                    matched_event = event_title_map.get(b.event_title.lower().strip())
                    if not matched_event:
                        for ev in events_list:
                            if ev.title.lower() in b.event_title.lower() or b.event_title.lower() in ev.title.lower():
                                matched_event = ev
                                break
                    if matched_event:
                        b.event_id = matched_event.id
                else:
                    matched_event = db.get(Event, b.event_id)

                if not b.custom_id:
                    u = db.get(User, b.user_id)
                    u_cid = (u.custom_id if u else None) or generate_user_custom_id(u.full_name if u else "User", u.phone_number if u else "0000")
                    e_cid = (matched_event.custom_id if matched_event else None) or generate_event_custom_id(b.event_title, b.event_time)
                    b.custom_id = generate_booking_custom_id(u_cid, e_cid, suffix=f"{b.id:04d}")

                if b.total_amount == 0:
                    b.payment_status = "Free Entry"
                    b.payment_id = "FREE"

            db.commit()
    except Exception as e:
        print(f"Schema migration warning: {e}")

    with SessionLocal() as db:
        seed_admin(db)
        seed_events(db)
    yield


app = FastAPI(title="MAXSHOW API", lifespan=lifespan)
 
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first_error = errors[0] if errors else None
    msg = first_error.get("msg", "Invalid input data.") if first_error else "Validation error."
    if msg.startswith("Value error, "):
        msg = msg[len("Value error, "):]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": msg, "errors": errors},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_sessions: dict[str, int] = {}
admin_sessions: set[str] = set()


def user_data(user: User) -> dict:
    if not user.custom_id:
        user.custom_id = generate_user_custom_id(user.full_name, user.phone_number)
    return {
        "id": user.id,
        "custom_id": user.custom_id,
        "username": user.username,
        "name": user.full_name,
        "email": user.email,
        "phone": user.phone_number,
    }


def require_user(request: Request, db: Session) -> User:
    session_token = request.cookies.get("maxshow_session")
    user_id = active_sessions.get(session_token) if session_token else None
    user = db.get(User, user_id) if user_id else None
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Please sign in to continue.")
    return user


def require_admin(request: Request) -> None:
    token = request.cookies.get("maxshow_admin_session")
    if not token or token not in admin_sessions:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin sign-in required.")


def event_data(event: Event) -> dict:
    if not event.custom_id:
        event.custom_id = generate_event_custom_id(event.title, event.time)
    return {
        "id": event.id,
        "custom_id": event.custom_id,
        "slug": event.slug,
        "title": event.title,
        "type": event.event_type,
        "venue": event.venue,
        "time": event.time,
        "location": event.location,
        "price": event.price,
        "image": event.image,
        "description": event.description,
        "category": event.category,
        "day": event.day,
    }


ADMIN_DEFAULT_USER = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_DEFAULT_PASS = os.getenv("ADMIN_PASSWORD", "admin123")


def seed_admin(db: Session) -> None:
    admin = db.query(Admin).filter(Admin.user_name == ADMIN_DEFAULT_USER).first()
    if not admin:
        new_admin = Admin(
            user_name=ADMIN_DEFAULT_USER,
            password=hash_password(ADMIN_DEFAULT_PASS),
        )
        db.add(new_admin)
        db.commit()


def seed_events(db: Session) -> None:
    if db.query(Event).count():
        return
    events = [
        ("moonlight-picnic", "Moonlight picnic & vinyl", "Outdoors", "Skyline Terrace · Hinjawadi", "Tonight, 8:00 PM", "Hinjawadi, Pune", 499, "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=85", "An open-air evening under string lights with curated vinyl records, artisan picnic bites, and golden sunset views across Hinjawadi.", "outdoors", "today"),
        ("blue-room", "Blue room: acoustic night", "Live music", "The Blue Room · Kasarwadi", "Friday, 7:30 PM", "Kasarwadi, Pimpri-Chinchwad", 399, "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=85", "Settle into an intimate evening of unplugged originals, soft lights, and a carefully curated local line-up.", "music", "weekend"),
        ("comedy-room", "After hours: a comedy room", "Comedy", "Laugh Lane · Nigdi", "Saturday, 8:00 PM", "Nigdi, Pimpri-Chinchwad", 299, "https://images.unsplash.com/photo-1511988617509-a57c8a288659?auto=format&fit=crop&w=1200&q=85", "A relaxed late-night set featuring sharp new comics and seasoned crowd favourites.", "comedy", "weekend"),
        ("watercolour", "Watercolour in the park", "Creative workshop", "Open Studio · Aundh", "Sunday, 11:00 AM", "Aundh, Pune", 450, "https://images.unsplash.com/photo-1545987796-200677ee1011?auto=format&fit=crop&w=1200&q=85", "A slow Sunday workshop for beginners and curious painters.", "create", "weekend"),
        ("rooftop-cinema", "Rooftop cinema club", "Film & outdoors", "Skyline Terrace · Hinjawadi", "Sunday, 6:30 PM", "Hinjawadi, Pune", 550, "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85", "A classic film under an open sky, paired with soft blankets and cinema snacks.", "outdoors", "weekend"),
        ("brunch-social", "Sunday brunch social", "Food & drinks", "Common Table · Pimpri", "Sunday, 12:30 PM", "Pimpri, Pune", 599, "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=85", "A leisurely afternoon meal designed for good conversation and new connections.", "food", "weekend"),
        ("sunrise-run", "Community sunrise run", "Move", "Riverside Track · Punawale", "Sunday, 6:00 AM", "Punawale, Pune", 0, "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1200&q=85", "Start the day with an easy, all-level community run.", "move", "today"),
    ]
    db.add_all([
        Event(
            custom_id=generate_event_custom_id(title, time),
            slug=slug,
            title=title,
            event_type=event_type,
            venue=venue,
            time=time,
            location=location,
            price=price,
            image=image,
            description=description,
            category=category,
            day=day,
        )
        for slug, title, event_type, venue, time, location, price, image, description, category, day in events
    ])
    db.commit()


@app.get("/api/auth/check-username")
def check_username(username: str, db: Session = Depends(get_db)) -> dict:
    clean = username.strip().lower()
    if not clean or len(clean) < 3 or len(clean) > 30:
        return {"available": False, "message": "Username must be between 3 and 30 characters."}
    if not re.match(r"^[a-z0-9_]+$", clean):
        return {"available": False, "message": "Username can only contain letters, numbers, and underscores (_)."}
    exists = db.query(User).filter(func.lower(User.username) == clean).first() is not None
    if exists:
        return {"available": False, "message": "This username is already taken. Please try something unique."}
    return {"available": True, "message": "Username is available!"}


@app.post("/api/auth/send-otp")
def send_otp(payload: SendOtpRequest, db: Session = Depends(get_db)) -> dict:
    clean_email = payload.email.strip().lower()

    # Generate a random secure 6-digit numeric OTP
    otp = f"{secrets.randbelow(900000) + 100000}"
    expires_at = time.time() + (5 * 60) # 5 minutes expiry

    otp_cache[clean_email] = {
        "otp": otp,
        "expires_at": expires_at,
        "verified": False,
    }

    # Dispatch email via SMTP
    sent = send_otp_email(clean_email, otp)
    print(f"[OTP LOG] Verification OTP for {clean_email}: {otp} (SMTP Sent: {sent})")

    return {
        "message": f"Verification code sent to {clean_email}." if sent else f"Verification code generated for {clean_email}.",
        "email": clean_email,
        "dev_otp": otp,
        "smtp_sent": sent,
    }


@app.post("/api/auth/verify-otp")
def verify_otp(payload: VerifyOtpRequest) -> dict:
    clean_email = payload.email.strip().lower()
    user_otp = payload.otp.strip()

    record = otp_cache.get(clean_email)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active verification code found for this email. Please click 'Send OTP'.",
        )

    if time.time() > record["expires_at"]:
        otp_cache.pop(clean_email, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code.",
        )

    if record["otp"] != user_otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please check your Gmail or request a new code.",
        )

    record["verified"] = True
    return {"message": "Email verified successfully!"}


@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> dict:
    clean_username = payload.username.strip().lower()
    clean_email = str(payload.email).strip().lower()
    clean_mobile = payload.mobile.strip()
    user_otp = (payload.otp or "").strip()

    # Validate OTP verification
    record = otp_cache.get(clean_email)
    otp_valid = False
    if record:
        if record.get("verified") is True:
            otp_valid = True
        elif user_otp and record.get("otp") == user_otp and time.time() <= record.get("expires_at", 0):
            otp_valid = True

    if not otp_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter and verify the 6-digit OTP code sent to your email before creating your account.",
        )

    if db.query(User).filter(func.lower(User.username) == clean_username).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This username is already taken. Please try something unique.",
        )
    if db.query(User).filter(User.phone_number == clean_mobile).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account already exists with this mobile number.",
        )

    cid = generate_user_custom_id(payload.full_name.strip(), clean_mobile)
    existing_cid_count = db.query(User).filter(User.custom_id.like(f"{cid}%")).count()
    if existing_cid_count > 0:
        cid = f"{cid}-{existing_cid_count + 1}"

    user = User(
        custom_id=cid,
        username=clean_username,
        full_name=payload.full_name.strip(),
        email=clean_email,
        phone_number=clean_mobile,
        password=hash_password(payload.password),
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
        otp_cache.pop(clean_email, None) # Clear OTP after successful registration
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account already exists with this username, email, or mobile number.",
        )
    return {
        "message": "Account created successfully.",
        "user": {
            "id": user.id,
            "custom_id": user.custom_id,
            "username": user.username,
            "name": user.full_name,
            "email": user.email,
        },
    }


@app.post("/api/auth/login")
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> dict:
    identifier = payload.email.strip().lower()
    raw_username = identifier.lstrip('@')
    
    # Query all users with matching email, username (with/without @), or phone
    criteria = [
        func.lower(User.email) == identifier,
        func.lower(User.username) == identifier,
        func.lower(User.username) == raw_username,
    ]
    if identifier.isdigit() and len(identifier) == 10:
        criteria.append(User.phone_number == identifier)

    candidate_users = db.query(User).filter(or_(*criteria)).all()

    matched_user = None
    for candidate in candidate_users:
        if verify_password(payload.password, candidate.password):
            matched_user = candidate
            break

    if not matched_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email/username or password. Please check your credentials.",
        )

    session_token = secrets.token_urlsafe(32)
    active_sessions[session_token] = matched_user.id
    response.set_cookie("maxshow_session", session_token, httponly=True, samesite="lax", max_age=86400 * 30, secure=False)
    return {"message": "Login successful.", "user": user_data(matched_user)}


@app.get("/api/auth/me")
def current_user(request: Request, db: Session = Depends(get_db)) -> dict:
    return {"user": user_data(require_user(request, db))}


@app.post("/api/auth/logout")
def logout(request: Request, response: Response) -> dict:
    session_token = request.cookies.get("maxshow_session")
    if session_token:
        active_sessions.pop(session_token, None)
    response.delete_cookie("maxshow_session")
    return {"message": "You have been logged out."}


@app.put("/api/auth/profile")
def update_profile(payload: UpdateProfileRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    user = require_user(request, db)
    clean_username = payload.username.strip().lower()
    clean_email = payload.email.strip().lower()
    clean_mobile = payload.mobile.strip()
    clean_name = payload.full_name.strip()

    # Check if username is taken by another user
    existing_username = db.query(User).filter(func.lower(User.username) == clean_username, User.id != user.id).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This username is already taken. Please try something unique.",
        )

    # Check if mobile is taken by another user
    existing_mobile = db.query(User).filter(User.phone_number == clean_mobile, User.id != user.id).first()
    if existing_mobile:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account already exists with this mobile number.",
        )

    user.full_name = clean_name
    user.username = clean_username
    user.email = clean_email
    user.phone_number = clean_mobile

    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not update profile because of duplicate details.",
        )

    return {
        "message": "Profile updated successfully.",
        "user": user_data(user),
    }


@app.delete("/api/auth/delete-account")
def delete_user_account(request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    user = require_user(request, db)
    
    # Delete user's bookings first
    db.query(Booking).filter(Booking.user_id == user.id).delete()
    
    # Delete the user
    db.delete(user)
    db.commit()

    # Invalidate session
    session_token = request.cookies.get("maxshow_session")
    if session_token:
        active_sessions.pop(session_token, None)
    response.delete_cookie("maxshow_session")

    return {"message": "Your account has been deleted successfully."}


@app.post("/api/admin/login")
def admin_login(payload: AdminLoginRequest, response: Response, db: Session = Depends(get_db)) -> dict:
    uname = payload.username.strip()
    pwd = payload.password
    admin = db.query(Admin).filter(Admin.user_name == uname).first()
    
    password_matches = False
    if admin:
        password_matches = verify_password(pwd, admin.password) or hmac.compare_digest(pwd, admin.password)
    
    # Fallback to default admin if admin is not in DB yet
    default_u = os.getenv("ADMIN_USERNAME", "admin")
    default_p = os.getenv("ADMIN_PASSWORD", "admin123")
    if not password_matches and uname == default_u and (pwd == default_p or pwd == "change-this-password" or pwd == "admin"):
        if not admin:
            admin = Admin(user_name=default_u, password=hash_password(pwd))
            db.add(admin)
            db.commit()
        password_matches = True

    if not password_matches:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials.")
    
    token = secrets.token_urlsafe(32)
    admin_sessions.add(token)
    response.set_cookie("maxshow_admin_session", token, httponly=True, samesite="lax", max_age=86400 * 30, secure=False)
    return {"message": "Admin sign-in successful."}


@app.post("/api/admin/logout")
def admin_logout(request: Request, response: Response) -> dict:
    token = request.cookies.get("maxshow_admin_session")
    if token:
        admin_sessions.discard(token)
    response.delete_cookie("maxshow_admin_session")
    return {"message": "Admin logged out."}


@app.get("/api/admin/me")
def admin_me(request: Request) -> dict:
    require_admin(request)
    return {"admin": True}


@app.post("/api/admin/upload-image")
def upload_image(payload: ImageUploadRequest, request: Request) -> dict:
    require_admin(request)
    allowed_types = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
    extension = allowed_types.get(payload.content_type)
    if not extension:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Upload a JPG, PNG, WEBP, or GIF image.")
    try:
        contents = base64.b64decode(payload.data, validate=True)
    except (ValueError, base64.binascii.Error):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The image data is invalid.")
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Images must be 5 MB or smaller.")
    upload_dir = FRONTEND_DIR / "uploads"
    upload_dir.mkdir(exist_ok=True)
    filename = f"{uuid4().hex}{extension}"
    (upload_dir / filename).write_bytes(contents)
    return {"url": f"/uploads/{filename}"}


@app.get("/api/events")
def list_events(db: Session = Depends(get_db)) -> dict:
    return {"events": [event_data(event) for event in db.query(Event).order_by(Event.created_at.desc(), Event.id.desc()).all()]}


@app.get("/api/events/{slug}")
def get_event(slug: str, db: Session = Depends(get_db)) -> dict:
    event = db.query(Event).filter(Event.slug == slug).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    return {"event": event_data(event)}


@app.get("/api/admin/overview")
@app.get("/api/admin/overview/")
def admin_overview(request: Request, db: Session = Depends(get_db)) -> dict:
    require_admin(request)
    users = db.query(User).order_by(User.created_at.desc(), User.id.desc()).all()
    events = db.query(Event).order_by(Event.created_at.desc(), Event.id.desc()).all()
    bookings = db.query(Booking).order_by(Booking.created_at.desc(), Booking.id.desc()).all()

    user_map = {user.id: user for user in users}
    event_map = {event.id: event for event in events}

    total_revenue = sum(b.total_amount for b in bookings)
    total_tickets = sum(b.ticket_count for b in bookings)
    paid_count = sum(1 for b in bookings if b.total_amount > 0)
    free_count = sum(1 for b in bookings if b.total_amount == 0)

    # Event sales count mapping
    event_sales_map: dict[int, dict] = {e.id: {"bookings": 0, "tickets": 0, "revenue": 0} for e in events}

    user_bookings_map: dict[int, list] = {u.id: [] for u in users}
    all_bookings_list = []

    for b in bookings:
        u = user_map.get(b.user_id)
        ev = event_map.get(b.event_id) if b.event_id else None
        if ev and ev.id in event_sales_map:
            event_sales_map[ev.id]["bookings"] += 1
            event_sales_map[ev.id]["tickets"] += b.ticket_count
            event_sales_map[ev.id]["revenue"] += b.total_amount

        is_free = (b.total_amount == 0) or (getattr(b, "payment_status", "") == "Free Entry")
        payment_status = "Free Entry" if is_free else (getattr(b, "payment_status", None) or "Paid (Razorpay)")
        payment_id = "FREE" if is_free else getattr(b, "payment_id", None)
        booking_code = b.custom_id or f"BKG-{b.id:04d}"
        user_code = (u.custom_id if u else None) or (f"USR-{b.user_id}" if u else "N/A")
        event_code = (ev.custom_id if ev else None) or (f"EVT-{b.event_id}" if b.event_id else "N/A")

        booking_item = {
            "id": b.id,
            "booking_id": booking_code,
            "user_id": b.user_id,
            "user_code": user_code,
            "user_name": u.full_name if u else "Deleted User",
            "username": (u.username if u else None) or "N/A",
            "user_email": u.email if u else "N/A",
            "user_phone": u.phone_number if u else "N/A",
            "event_id": b.event_id,
            "event_code": event_code,
            "title": b.event_title,
            "location": b.event_location,
            "time": b.event_time,
            "tickets": b.ticket_count,
            "total": b.total_amount,
            "payment_status": payment_status,
            "payment_id": payment_id,
            "created_at": b.created_at.isoformat() if b.created_at else "",
        }
        all_bookings_list.append(booking_item)
        if b.user_id in user_bookings_map:
            user_bookings_map[b.user_id].append({
                "id": b.id,
                "booking_id": booking_code,
                "event_id": b.event_id,
                "event_code": event_code,
                "title": b.event_title,
                "location": b.event_location,
                "time": b.event_time,
                "tickets": b.ticket_count,
                "total": b.total_amount,
                "payment_status": payment_status,
                "payment_id": payment_id,
                "created_at": b.created_at.isoformat() if b.created_at else "",
            })

    users_list = []
    for u in users:
        u_bookings = user_bookings_map.get(u.id, [])
        u_total_spent = sum(item["total"] for item in u_bookings)
        u_ticket_count = sum(item["tickets"] for item in u_bookings)
        users_list.append({
            "id": u.id,
            "user_id": u.custom_id or generate_user_custom_id(u.full_name, u.phone_number),
            "username": u.username or "N/A",
            "name": u.full_name,
            "email": u.email,
            "phone": u.phone_number,
            "created_at": u.created_at.isoformat() if u.created_at else "",
            "total_spent": u_total_spent,
            "ticket_count": u_ticket_count,
            "bookings_count": len(u_bookings),
            "bookings": u_bookings,
        })

    events_list = []
    for e in events:
        e_data = event_data(e)
        sales = event_sales_map.get(e.id, {"bookings": 0, "tickets": 0, "revenue": 0})
        e_data["bookings_count"] = sales["bookings"]
        e_data["tickets_sold"] = sales["tickets"]
        e_data["revenue"] = sales["revenue"]
        events_list.append(e_data)

    return {
        "stats": {
            "users": len(users),
            "events": len(events),
            "bookings": len(bookings),
            "revenue": total_revenue,
            "tickets": total_tickets,
            "paid_bookings": paid_count,
            "free_bookings": free_count,
        },
        "users": users_list,
        "events": events_list,
        "all_bookings": all_bookings_list,
    }


@app.post("/api/admin/events", status_code=status.HTTP_201_CREATED)
def create_event(payload: EventRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    require_admin(request)
    cid = generate_event_custom_id(payload.title, payload.time)
    event = Event(custom_id=cid, **payload.model_dump())
    db.add(event)
    try:
        db.commit()
        db.refresh(event)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An event with this slug already exists.")
    return {"event": event_data(event)}


@app.put("/api/admin/events/{event_id}")
def update_event(event_id: int, payload: EventRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    require_admin(request)
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    for key, value in payload.model_dump().items():
        setattr(event, key, value)
    event.custom_id = generate_event_custom_id(payload.title, payload.time)
    try:
        db.commit()
        db.refresh(event)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An event with this slug already exists.")
    return {"event": event_data(event)}


@app.delete("/api/admin/events/{event_id}")
def delete_event(event_id: int, request: Request, db: Session = Depends(get_db)) -> dict:
    require_admin(request)
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    db.delete(event)
    db.commit()
    return {"message": "Event deleted."}


@app.delete("/api/admin/users/{user_id}")
def delete_user(user_id: int, request: Request, db: Session = Depends(get_db)) -> dict:
    require_admin(request)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    db.query(Booking).filter(Booking.user_id == user_id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    for token, session_user_id in list(active_sessions.items()):
        if session_user_id == user_id:
            active_sessions.pop(token, None)
    return {"message": "User deleted."}


@app.delete("/api/admin/bookings/{booking_id}")
def delete_booking(booking_id: int, request: Request, db: Session = Depends(get_db)) -> dict:
    require_admin(request)
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")
    db.delete(booking)
    db.commit()
    return {"message": "Booking deleted successfully."}


def create_razorpay_order(amount_in_paise: int, receipt: str, notes: dict = None) -> dict:
    url = "https://api.razorpay.com/v1/orders"
    payload = {
        "amount": amount_in_paise,
        "currency": "INR",
        "receipt": receipt,
        "notes": notes or {},
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")

    credentials = f"{RAZORPAY_KEY_ID}:{RAZORPAY_KEY_SECRET}"
    encoded_creds = base64.b64encode(credentials.encode("utf-8")).decode("ascii")
    req.add_header("Authorization", f"Basic {encoded_creds}")
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body)
    except urllib.error.HTTPError as e:
        error_content = e.read().decode("utf-8", errors="ignore")
        try:
            err_json = json.loads(error_content)
            desc = err_json.get("error", {}).get("description", "Failed to create Razorpay order.")
        except Exception:
            desc = f"Razorpay API Error: {e.code}"
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=desc)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Payment service error: {str(e)}",
        )


@app.post("/api/bookings")
@app.post("/api/bookings/")
def create_booking(payload: BookingRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    user = require_user(request, db)
    matched_event = resolve_event(db, payload.event_id, payload.event_slug, payload.title)
    u_cid = user.custom_id or generate_user_custom_id(user.full_name, user.phone_number)
    e_cid = (matched_event.custom_id if matched_event else None) or generate_event_custom_id(payload.title, payload.time)
    booking_cid = generate_booking_custom_id(u_cid, e_cid)

    booking = Booking(
        custom_id=booking_cid,
        user_id=user.id,
        event_id=matched_event.id if matched_event else None,
        event_title=payload.title.strip(),
        event_location=payload.location.strip(),
        event_time=payload.time.strip(),
        ticket_count=payload.quantity,
        total_amount=payload.price * payload.quantity,
        payment_status="Free Entry" if payload.price == 0 else "Paid",
        payment_id="FREE" if payload.price == 0 else None,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return {"message": "Tickets booked successfully.", "booking_id": booking.custom_id or str(booking.id)}


@app.post("/api/payment/create-order")
@app.post("/api/payment/create-order/")
def create_payment_order(
    payload: CreatePaymentOrderRequest, request: Request, db: Session = Depends(get_db)
) -> dict:
    user = require_user(request, db)
    total_amount = payload.price * payload.quantity
    matched_event = resolve_event(db, payload.event_id, payload.event_slug, payload.title)

    # Handle Free Events directly -> write booking to DB
    if total_amount == 0:
        u_cid = user.custom_id or generate_user_custom_id(user.full_name, user.phone_number)
        e_cid = (matched_event.custom_id if matched_event else None) or generate_event_custom_id(payload.title, payload.time)
        booking_cid = generate_booking_custom_id(u_cid, e_cid)

        booking = Booking(
            custom_id=booking_cid,
            user_id=user.id,
            event_id=matched_event.id if matched_event else None,
            event_title=payload.title.strip(),
            event_location=payload.location.strip(),
            event_time=payload.time.strip(),
            ticket_count=payload.quantity,
            total_amount=0,
            payment_status="Free Entry",
            payment_id="FREE",
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        return {
            "free": True,
            "message": "Tickets booked successfully.",
            "booking_id": booking.custom_id or str(booking.id),
        }

    # Paid events -> create Razorpay Order (DO NOT insert booking into DB yet)
    receipt_id = f"rcpt_{uuid4().hex[:12]}"
    amount_in_paise = total_amount * 100
    notes = {
        "user_id": str(user.id),
        "user_custom_id": user.custom_id or generate_user_custom_id(user.full_name, user.phone_number),
        "event_id": str(matched_event.id) if matched_event else "",
        "event_custom_id": matched_event.custom_id if (matched_event and matched_event.custom_id) else "",
        "event_title": payload.title[:50],
        "tickets": str(payload.quantity),
    }
    order = create_razorpay_order(amount_in_paise, receipt_id, notes)
    return {
        "free": False,
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order.get("currency", "INR"),
        "key_id": RAZORPAY_KEY_ID,
    }


@app.post("/api/payment/verify")
@app.post("/api/payment/verify/")
def verify_payment(
    payload: VerifyPaymentRequest, request: Request, db: Session = Depends(get_db)
) -> dict:
    user = require_user(request, db)

    # Verify HMAC-SHA256 signature
    message = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}"
    generated_signature = hmac.new(
        RAZORPAY_KEY_SECRET.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(generated_signature, payload.razorpay_signature):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment verification failed: invalid signature.",
        )

    # Signature is valid -> record confirmed booking in database
    matched_event = resolve_event(db, payload.event_id, payload.event_slug, payload.title)
    u_cid = user.custom_id or generate_user_custom_id(user.full_name, user.phone_number)
    e_cid = (matched_event.custom_id if matched_event else None) or generate_event_custom_id(payload.title, payload.time)
    booking_cid = generate_booking_custom_id(u_cid, e_cid)

    booking = Booking(
        custom_id=booking_cid,
        user_id=user.id,
        event_id=matched_event.id if matched_event else None,
        event_title=payload.title.strip(),
        event_location=payload.location.strip(),
        event_time=payload.time.strip(),
        ticket_count=payload.quantity,
        total_amount=payload.price * payload.quantity,
        payment_status="Paid (Razorpay)",
        payment_id=payload.razorpay_payment_id,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    return {
        "message": "Payment verified and tickets booked successfully.",
        "booking_id": booking.custom_id or str(booking.id),
        "payment_id": payload.razorpay_payment_id,
    }


@app.get("/api/bookings")
@app.get("/api/bookings/")
def list_bookings(request: Request, db: Session = Depends(get_db)) -> dict:
    user = require_user(request, db)
    bookings = db.query(Booking).filter(Booking.user_id == user.id).order_by(Booking.created_at.desc()).all()
    results = []
    for booking in bookings:
        ev = booking.event or (db.get(Event, booking.event_id) if booking.event_id else None)
        is_free = (booking.total_amount == 0) or (getattr(booking, "payment_status", "") == "Free Entry")
        results.append({
            "id": booking.id,
            "booking_id": booking.custom_id or f"BKG-{booking.id:04d}",
            "event_id": (ev.custom_id if ev else None) or (f"EVT-{booking.event_id}" if booking.event_id else "N/A"),
            "event_slug": ev.slug if ev else None,
            "event_image": ev.image if ev else "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=85",
            "title": booking.event_title,
            "location": booking.event_location,
            "time": booking.event_time,
            "tickets": booking.ticket_count,
            "total": booking.total_amount,
            "payment_status": "Free Entry" if is_free else (getattr(booking, "payment_status", None) or "Paid (Razorpay)"),
            "payment_id": "FREE" if is_free else getattr(booking, "payment_id", None),
            "created_at": booking.created_at.isoformat() if booking.created_at else "",
        })
    return {"bookings": results}


# Keep this last: API routes above it take priority, then the frontend is served at the root.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)


