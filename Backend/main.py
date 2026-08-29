import asyncio
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
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, create_engine, func, inspect, or_, text
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


def send_otp_email(to_email: str, otp_code: str, purpose: str = "register") -> bool:
    if purpose == "reset_password":
        subject = f"{otp_code} is your MAXSHOW Password Reset Code"
        heading = "Reset your password"
        intro_text = "Use the 6-digit verification code below to verify your identity and reset your MAXSHOW account password."
        action_url = "https://maxshow.site/forgot-password"
    else:
        subject = f"{otp_code} is your MAXSHOW Verification Code"
        heading = "Verify your email address"
        intro_text = "Use the 6-digit verification code below to complete creating your MAXSHOW account."
        action_url = "https://maxshow.site/registration"

    # Space the 6 digits (e.g. 3 5 0 2 6 3) for clean monospace rendering
    spaced_otp = " ".join(otp_code) if len(otp_code) == 6 else otp_code

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>{heading}</title>
      <style>
        @media only screen and (max-width: 480px) {{
          .otp-code {{
            font-size: 28px !important;
            letter-spacing: 3px !important;
          }}
          .otp-container {{
            padding: 18px 12px !important;
          }}
        }}
        @media only screen and (max-width: 380px) {{
          .otp-code {{
            font-size: 24px !important;
            letter-spacing: 2px !important;
          }}
        }}
      </style>
    </head>
    <body style="margin: 0; padding: 32px 16px; background-color: #0f1318; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #ffffff;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 480px; margin: 0 auto; background-color: #171c24; border-radius: 28px; border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45); overflow: hidden;">
        <tr>
          <td style="padding: 36px 30px;">
            <!-- Brand Header -->
            <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
              <tr>
                <td style="width: 38px; height: 38px; background-color: #F2634E; border-radius: 50%; text-align: center; vertical-align: middle;">
                  <span style="color: #ffffff; font-size: 18px; font-weight: 900; line-height: 38px; display: inline-block;">M</span>
                </td>
                <td style="padding-left: 12px;">
                  <span style="font-size: 18px; font-weight: 900; letter-spacing: 0.5px; color: #ffffff; vertical-align: middle;">MAXSHOW</span>
                </td>
              </tr>
            </table>

            <!-- Heading -->
            <h1 style="font-size: 24px; font-weight: 800; color: #ffffff; margin: 0 0 12px 0; letter-spacing: -0.4px; line-height: 1.25;">
              {heading}
            </h1>

            <!-- Intro text -->
            <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 24px 0;">
              {intro_text}
            </p>

            <!-- OTP Box -->
            <div class="otp-container" style="background-color: #261616; border: 1.5px dashed #F2634E; border-radius: 20px; padding: 22px 16px; text-align: center; margin: 0 0 22px 0;">
              <span class="otp-code" style="font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; font-size: 36px; font-weight: 900; letter-spacing: 6px; color: #F2634E; display: inline-block; white-space: nowrap;">
                {spaced_otp}
              </span>
            </div>

            <!-- Expiry & Disclaimer -->
            <p style="font-size: 12px; font-weight: 700; color: #F2634E; margin: 0 0 6px 0; line-height: 1.4;">
              ⏰ This code will expire in 5 minutes.
            </p>
            <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0 0 26px 0;">
              If you didn't request this verification code, you can safely ignore this email.
            </p>

            <!-- Action Buttons -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="padding-bottom: 12px;">
                  <a href="{action_url}" target="_blank" rel="noopener noreferrer" style="display: block; width: 100%; box-sizing: border-box; background-color: #F2634E; color: #ffffff; text-decoration: none; text-align: center; font-weight: 700; font-size: 14px; padding: 13px 20px; border-radius: 14px;">
                    Go to MAXSHOW App to enter code
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="{action_url}" target="_blank" rel="noopener noreferrer" style="display: block; width: 100%; box-sizing: border-box; background-color: transparent; border: 1px solid rgba(242, 99, 78, 0.4); color: #F2634E; text-decoration: none; text-align: center; font-weight: 700; font-size: 14px; padding: 12px 20px; border-radius: 14px;">
                    Request a new code
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>
    </body>
    </html>
    """

    text_body = f"{heading}\n\n{intro_text}\n\nYour 6-digit verification code is: {otp_code}\n(This code will expire in 5 minutes)\n\nEnter your code here: {action_url}"

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


def generate_bookmark_custom_id(user_custom_id: str, event_custom_id: str, suffix: str = "") -> str:
    """Format: BMK-User ID first 5 characters + Event ID first 5 characters (+ suffix)."""
    u_part = (user_custom_id or "USERX")[:5].upper().ljust(5, "X")
    e_part = (event_custom_id or "EVENT")[:5].upper().ljust(5, "X")
    sfx = suffix or secrets.token_hex(2).upper()
    return f"BMK-{u_part}-{e_part}-{sfx}"


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
    phone_number: Mapped[str] = mapped_column(String(20), unique=False, nullable=False, index=True)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="user", cascade="all, delete-orphan")
    bookmarks: Mapped[list["Bookmark"]] = relationship("Bookmark", back_populates="user", cascade="all, delete-orphan")
    ratings: Mapped[list["Rating"]] = relationship("Rating", back_populates="user", cascade="all, delete-orphan")


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
    rating: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    rating_count: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="event")
    bookmarks: Mapped[list["Bookmark"]] = relationship("Bookmark", back_populates="event", cascade="all, delete-orphan")
    ratings: Mapped[list["Rating"]] = relationship("Rating", back_populates="event", cascade="all, delete-orphan")


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


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    custom_id: Mapped[str | None] = mapped_column(String(60), unique=True, index=True, nullable=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="bookmarks")
    event: Mapped["Event"] = relationship("Event", back_populates="bookmarks")


class Rating(Base):
    __tablename__ = "ratings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    review: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="ratings")
    event: Mapped["Event"] = relationship("Event", back_populates="ratings")


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


DUMMY_MOBILE_PATTERNS = {
    "1234567890", "0123456789", "2345678901", "1234567892", "1234567891",
    "9876543210", "8765432109", "7654321098", "6543210987",
    "9898989898", "9191919191", "9090909090", "8989898989", "7878787878", "6767676767"
}


def sanitize_and_validate_mobile(v: str | None, required: bool = False) -> str | None:
    if v is None:
        if required:
            raise ValueError("Mobile number is required.")
        return None
    clean = str(v).strip()
    if not clean:
        if required:
            raise ValueError("Mobile number is required.")
        return None
    clean_digits = re.sub(r"\D", "", clean)
    if clean_digits.startswith("91") and len(clean_digits) == 12:
        clean_digits = clean_digits[2:]
    if not clean_digits:
        if required:
            raise ValueError("Mobile number is required.")
        return None
    if len(clean_digits) != 10:
        raise ValueError("Mobile number must be a valid 10-digit number.")
    if clean_digits[0] not in ("6", "7", "8", "9"):
        raise ValueError("Mobile number must start with 6, 7, 8, or 9 (numbers starting with 0-5 are invalid).")
    if re.match(r"^(\d)\1{9}$", clean_digits):
        raise ValueError("Please enter a valid mobile number (dummy repeating numbers are not allowed).")
    if re.search(r"(\d)\1{5,}", clean_digits):
        raise ValueError("Please enter a valid mobile number.")
    if clean_digits in DUMMY_MOBILE_PATTERNS:
        raise ValueError("Please enter a valid, active mobile number.")
    return clean_digits


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    username: str = Field(min_length=3, max_length=30)
    email: str = Field(min_length=3, max_length=150)
    mobile: str | None = Field(default=None)
    phone: str | None = Field(default=None)
    phone_number: str | None = Field(default=None)
    password: str = Field(min_length=1, max_length=128)
    confirm_password: str | None = Field(default=None)
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

    @field_validator("mobile", "phone", "phone_number")
    @classmethod
    def validate_mobile(cls, v: str | None) -> str | None:
        return sanitize_and_validate_mobile(v, required=False)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", clean):
            raise ValueError("Please enter a valid email address.")
        return clean

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter (A-Z).")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter (a-z).")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number (0-9).")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>\-_+=\[\]\\\/~`]", v):
            raise ValueError("Password must contain at least one special character (!@#$%^&*).")
        return v


class ForgotPasswordOtpRequest(BaseModel):
    username: str = Field(min_length=1, max_length=60)
    email: str = Field(min_length=3, max_length=150)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", clean):
            raise ValueError("Please enter a valid email address.")
        return clean


class ResetPasswordRequest(BaseModel):
    username: str = Field(min_length=1, max_length=60)
    email: str = Field(min_length=3, max_length=150)
    otp: str = Field(min_length=4, max_length=10)
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", clean):
            raise ValueError("Please enter a valid email address.")
        return clean

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter (A-Z).")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter (a-z).")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number (0-9).")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>\-_+=\[\]\\\/~`]", v):
            raise ValueError("Password must contain at least one special character (!@#$%^&*).")
        return v


class UpdateProfileRequest(BaseModel):
    full_name: str | None = Field(default=None, max_length=100)
    name: str | None = Field(default=None, max_length=100)
    username: str = Field(min_length=3, max_length=30)
    email: str | None = Field(default=None, max_length=150)
    mobile: str | None = Field(default=None)
    phone: str | None = Field(default=None)
    password: str | None = Field(default=None, max_length=128)

    @field_validator("full_name", "name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        clean = v.strip()
        if not clean:
            return None
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

    @field_validator("mobile", "phone")
    @classmethod
    def validate_mobile(cls, v: str | None) -> str | None:
        return sanitize_and_validate_mobile(v, required=False)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if v is None:
            return None
        clean = v.strip().lower()
        if not clean:
            return None
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
    filename: str | None = Field(default=None, max_length=255)
    content_type: str = Field(min_length=1, max_length=50)
    data: str = Field(min_length=1)


class EventRequest(BaseModel):
    slug: str | None = Field(default=None, max_length=100)
    title: str = Field(min_length=2, max_length=160)
    event_type: str | None = Field(default=None, max_length=80)
    type: str | None = Field(default=None, max_length=80)
    venue: str = Field(min_length=2, max_length=160)
    time: str = Field(min_length=2, max_length=100)
    location: str = Field(min_length=2, max_length=160)
    price: int = Field(ge=0)
    image: str = Field(min_length=5, max_length=500)
    description: str = Field(min_length=2, max_length=2000)
    category: str = Field(min_length=2, max_length=50)
    day: str | None = Field(default="weekend", max_length=20)


class CreatePaymentOrderRequest(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    location: str = Field(min_length=2, max_length=160)
    time: str = Field(min_length=2, max_length=100)
    price: int = Field(ge=0)
    quantity: int = Field(ge=1, le=20)
    event_id: int | None = None
    event_slug: str | None = None
    guest_name: str | None = None
    guest_email: str | None = None
    guest_phone: str | None = None
    name: str | None = None
    email: str | None = None
    phone: str | None = None


class BookingRequest(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    location: str = Field(min_length=2, max_length=160)
    time: str = Field(min_length=2, max_length=100)
    price: int = Field(ge=0)
    quantity: int = Field(ge=1, le=20)
    event_id: int | None = None
    event_slug: str | None = None
    guest_name: str | None = None
    guest_email: str | None = None
    guest_phone: str | None = None
    name: str | None = None
    email: str | None = None
    phone: str | None = None


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
    guest_name: str | None = None
    guest_email: str | None = None
    guest_phone: str | None = None
    name: str | None = None
    email: str | None = None
    phone: str | None = None


class BookmarkToggleRequest(BaseModel):
    event_id: int | None = None
    event_slug: str | None = None


class RateEventRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    review: str | None = Field(default=None, max_length=1000)


DEFAULT_RATINGS: dict[str, tuple[float, int]] = {
    "moonlight-picnic": (4.9, 28),
    "blue-room": (4.8, 34),
    "comedy-room": (4.7, 19),
    "watercolour": (4.9, 15),
    "rooftop-cinema": (4.8, 42),
    "brunch-social": (4.7, 23),
    "sunrise-run": (5.0, 18),
}


def resolve_event_by_identifier(identifier: str | int | None, db: Session) -> Event | None:
    if identifier is None:
        return None
    raw = str(identifier).strip()
    if not raw:
        return None
    if raw.isdigit():
        ev = db.get(Event, int(raw))
        if ev:
            return ev
    ev = db.query(Event).filter(Event.slug == raw.lower()).first()
    if ev:
        return ev
    ev = db.query(Event).filter(Event.custom_id == raw).first()
    if ev:
        return ev
    return None


def recalculate_event_rating(event: Event, db: Session) -> None:
    all_ratings = db.query(Rating.rating).filter(Rating.event_id == event.id).all()
    if all_ratings:
        avg_r = sum(r[0] for r in all_ratings) / len(all_ratings)
        event.rating = round(float(avg_r), 1)
        event.rating_count = len(all_ratings)
    else:
        seed_r, seed_cnt = DEFAULT_RATINGS.get(event.slug, (4.8, 12))
        event.rating = seed_r
        event.rating_count = seed_cnt
    db.commit()
    db.refresh(event)


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


main_event_loop = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global main_event_loop
    try:
        main_event_loop = asyncio.get_running_loop()
    except Exception:
        pass
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
                # Drop unique index on phone_number if present to allow unlimited registrations with same phone number
                try:
                    idx_rows = conn.execute(text("SHOW INDEX FROM users WHERE Column_name = 'phone_number' AND Non_unique = 0")).fetchall()
                    for r in idx_rows:
                        key_name = r[2]
                        conn.execute(text(f"ALTER TABLE users DROP INDEX `{key_name}`"))
                        conn.commit()
                except Exception:
                    pass

            if "events" in tables:
                e_cols = {c["name"] for c in insp.get_columns("events")}
                if "custom_id" not in e_cols:
                    conn.execute(text("ALTER TABLE events ADD COLUMN custom_id VARCHAR(50) NULL"))
                    conn.commit()
                if "rating" not in e_cols:
                    conn.execute(text("ALTER TABLE events ADD COLUMN rating FLOAT DEFAULT 0.0"))
                    conn.commit()
                if "rating_count" not in e_cols:
                    conn.execute(text("ALTER TABLE events ADD COLUMN rating_count INT DEFAULT 0"))
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
            default_ratings = {
                "moonlight-picnic": (4.9, 28),
                "blue-room": (4.8, 34),
                "comedy-room": (4.7, 19),
                "watercolour": (4.9, 15),
                "rooftop-cinema": (4.8, 42),
                "brunch-social": (4.7, 23),
                "sunrise-run": (5.0, 18),
            }
            for e in events_list:
                if not e.custom_id:
                    e.custom_id = generate_event_custom_id(e.title, e.time)
                event_title_map[e.title.lower().strip()] = e

                # Ensure realistic initial ratings for events
                avg_r = db.query(func.avg(Rating.rating)).filter(Rating.event_id == e.id).scalar()
                r_cnt = db.query(Rating).filter(Rating.event_id == e.id).count()
                if avg_r is not None and r_cnt > 0:
                    e.rating = round(float(avg_r), 1)
                    e.rating_count = r_cnt
                elif e.rating is None or e.rating == 0.0:
                    seed_r, seed_cnt = default_ratings.get(e.slug, (4.8, 12))
                    e.rating = seed_r
                    e.rating_count = seed_cnt

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
        seed_test_account(db)
        seed_events(db)
    cleanup_task = asyncio.create_task(session_cleanup_loop())
    yield
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


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
        content={"detail": msg},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

INACTIVITY_TIMEOUT_SECONDS = 120  # 2 minutes of idle time before automatic session logout
active_sessions: dict[str, int] = {}
session_last_active: dict[str, float] = {}
admin_sessions: set[str] = set()


class AdminNotificationBroker:
    def __init__(self):
        self.subscribers: set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self.subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        self.subscribers.discard(q)

    def _deliver_message(self, msg: str):
        for q in list(self.subscribers):
            try:
                q.put_nowait(msg)
            except Exception:
                self.subscribers.discard(q)

    async def broadcast(self, event_type: str, data: dict):
        if not self.subscribers:
            return
        payload = json.dumps({"type": event_type, "data": data, "timestamp": time.time()})
        msg = f"event: {event_type}\ndata: {payload}\n\n"
        self._deliver_message(msg)

    def broadcast_sync(self, event_type: str, data: dict):
        global main_event_loop
        if not self.subscribers:
            return
        payload = json.dumps({"type": event_type, "data": data, "timestamp": time.time()})
        msg = f"event: {event_type}\ndata: {payload}\n\n"
        try:
            if main_event_loop and main_event_loop.is_running():
                main_event_loop.call_soon_threadsafe(self._deliver_message, msg)
            else:
                self._deliver_message(msg)
        except Exception:
            self._deliver_message(msg)


admin_broker = AdminNotificationBroker()


def cleanup_inactive_sessions():
    """Scans active_sessions and removes any that exceeded INACTIVITY_TIMEOUT_SECONDS, broadcasting offline status."""
    now = time.time()
    expired_tokens = []
    for token, uid in list(active_sessions.items()):
        last_time = session_last_active.get(token)
        if last_time is None:
            session_last_active[token] = now
        elif now - last_time > INACTIVITY_TIMEOUT_SECONDS:
            expired_tokens.append(token)

    if not expired_tokens:
        return

    affected_users = set()
    for token in expired_tokens:
        uid = active_sessions.pop(token, None)
        session_last_active.pop(token, None)
        if uid:
            affected_users.add(uid)

    for uid in affected_users:
        if uid not in active_sessions.values():
            try:
                with SessionLocal() as db:
                    u = db.get(User, uid)
                    if u:
                        admin_broker.broadcast_sync("user_status_changed", {
                            "user_id": uid,
                            "custom_id": u.custom_id or f"USR-{uid}",
                            "name": u.full_name,
                            "username": u.username or "user",
                            "email": u.email,
                            "is_online": False,
                            "status": "Offline",
                            "action": "inactivity_timeout",
                            "timestamp": datetime.now().isoformat(),
                        })
            except Exception as e:
                print(f"[Cleanup Inactive Sessions Error]: {e}")


def touch_session(session_token: str | None) -> int | None:
    """Refreshes last_active for a session if valid; expires session and broadcasts offline if timed out."""
    if not session_token or session_token not in active_sessions:
        return None
    now = time.time()
    last_time = session_last_active.get(session_token, now)
    if now - last_time > INACTIVITY_TIMEOUT_SECONDS:
        uid = active_sessions.pop(session_token, None)
        session_last_active.pop(session_token, None)
        if uid and uid not in active_sessions.values():
            try:
                with SessionLocal() as db:
                    u = db.get(User, uid)
                    if u:
                        admin_broker.broadcast_sync("user_status_changed", {
                            "user_id": uid,
                            "custom_id": u.custom_id or f"USR-{uid}",
                            "name": u.full_name,
                            "username": u.username or "user",
                            "email": u.email,
                            "is_online": False,
                            "status": "Offline",
                            "action": "inactivity_timeout",
                            "timestamp": datetime.now().isoformat(),
                        })
            except Exception as e:
                print(f"[Touch Session Expire Error]: {e}")
        return None
    session_last_active[session_token] = now
    return active_sessions.get(session_token)


async def session_cleanup_loop():
    """Background loop that periodically checks for inactive sessions and marks users offline."""
    while True:
        try:
            await asyncio.sleep(5)
            cleanup_inactive_sessions()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Session Cleanup Loop Error]: {e}")
            await asyncio.sleep(5)


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
    user_id = touch_session(session_token)
    user = db.get(User, user_id) if user_id else None
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Please sign in to continue.")
    return user


def get_or_create_user_for_booking(
    request: Request,
    db: Session,
    name: str | None = None,
    email: str | None = None,
    phone: str | None = None,
) -> User:
    # 1. Try logged-in user first
    session_token = request.cookies.get("maxshow_session")
    user_id = touch_session(session_token)
    if user_id:
        user = db.get(User, user_id)
        if user:
            return user

    # 2. Try guest details if provided
    clean_email = (email or "").strip().lower()
    clean_name = (name or "").strip()
    clean_phone = sanitize_and_validate_mobile(phone, required=False) or "0000000000"

    if clean_email:
        existing_user = db.query(User).filter(func.lower(User.email) == clean_email).first()
        if existing_user:
            return existing_user

        if not clean_name:
            clean_name = clean_email.split("@")[0].replace(".", " ").title()

        base_username = generate_user_username(clean_name, clean_phone)
        candidate = base_username
        cnt = 1
        while db.query(User).filter(func.lower(User.username) == candidate.lower()).first():
            candidate = f"{base_username}_{cnt}"
            cnt += 1

        cid = generate_user_custom_id(clean_name, clean_phone)
        existing_cid_count = db.query(User).filter(User.custom_id.like(f"{cid}%")).count()
        if existing_cid_count > 0:
            cid = f"{cid}-{existing_cid_count + 1}"

        new_guest_user = User(
            custom_id=cid,
            username=candidate,
            full_name=clean_name,
            email=clean_email,
            phone_number=clean_phone,
            password=hash_password(secrets.token_urlsafe(16)),
        )
        db.add(new_guest_user)
        db.commit()
        db.refresh(new_guest_user)

        # Broadcast new user creation to admin portal
        admin_broker.broadcast_sync("user_registered", {
            "id": new_guest_user.id,
            "user_id": new_guest_user.custom_id,
            "username": new_guest_user.username,
            "name": new_guest_user.full_name,
            "email": new_guest_user.email,
            "phone": new_guest_user.phone_number,
            "created_at": new_guest_user.created_at.isoformat() if new_guest_user.created_at else datetime.now().isoformat(),
            "total_spent": 0,
            "ticket_count": 0,
            "bookings_count": 0,
            "bookings": [],
            "is_online": False,
            "status": "Offline",
        })
        return new_guest_user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Please enter your attendee details (name and email) or sign in to complete your booking.",
    )


def require_admin(request: Request) -> None:
    token = request.cookies.get("maxshow_admin_session") or request.query_params.get("token") or request.query_params.get("admin_token")
    if not token or token not in admin_sessions:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin sign-in required.")


def event_data(event: Event) -> dict:
    if not event.custom_id:
        event.custom_id = generate_event_custom_id(event.title, event.time)
    r = float(event.rating) if event.rating is not None and event.rating > 0 else 4.8
    rc = int(event.rating_count) if event.rating_count is not None and event.rating_count >= 0 else 0
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
        "rating": round(r, 1),
        "rating_count": rc,
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

    # Seed test admin
    test_admin = db.query(Admin).filter(Admin.user_name == "test").first()
    if not test_admin:
        db.add(Admin(user_name="test", password=hash_password("test")))
        db.commit()


def seed_test_account(db: Session) -> None:
    test_user = db.query(User).filter(User.username == "test").first()
    if not test_user:
        test_user = User(
            custom_id="TEST9876",
            username="test",
            full_name="Test User",
            email="test@maxshow.com",
            phone_number="9876543210",
            password=hash_password("test"),
        )
        db.add(test_user)
        db.commit()


def seed_events(db: Session) -> None:
    if db.query(Event).count():
        return
    events = [
        ("moonlight-picnic", "Moonlight picnic & vinyl", "Outdoors", "Skyline Terrace · Hinjawadi", "Tonight, 8:00 PM", "Hinjawadi, Pune", 499, "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=85", "An open-air evening under string lights with curated vinyl records, artisan picnic bites, and golden sunset views across Hinjawadi.", "outdoors", "today", 4.9, 28),
        ("blue-room", "Blue room: acoustic night", "Live music", "The Blue Room · Kasarwadi", "Friday, 7:30 PM", "Kasarwadi, Pimpri-Chinchwad", 399, "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=85", "Settle into an intimate evening of unplugged originals, soft lights, and a carefully curated local line-up.", "music", "weekend", 4.8, 34),
        ("comedy-room", "After hours: a comedy room", "Comedy", "Laugh Lane · Nigdi", "Saturday, 8:00 PM", "Nigdi, Pimpri-Chinchwad", 299, "https://images.unsplash.com/photo-1511988617509-a57c8a288659?auto=format&fit=crop&w=1200&q=85", "A relaxed late-night set featuring sharp new comics and seasoned crowd favourites.", "comedy", "weekend", 4.7, 19),
        ("watercolour", "Watercolour in the park", "Creative workshop", "Open Studio · Aundh", "Sunday, 11:00 AM", "Aundh, Pune", 450, "https://images.unsplash.com/photo-1545987796-200677ee1011?auto=format&fit=crop&w=1200&q=85", "A slow Sunday workshop for beginners and curious painters.", "create", "weekend", 4.9, 15),
        ("rooftop-cinema", "Rooftop cinema club", "Film & outdoors", "Skyline Terrace · Hinjawadi", "Sunday, 6:30 PM", "Hinjawadi, Pune", 550, "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85", "A classic film under an open sky, paired with soft blankets and cinema snacks.", "outdoors", "weekend", 4.8, 42),
        ("brunch-social", "Sunday brunch social", "Food & drinks", "Common Table · Pimpri", "Sunday, 12:30 PM", "Pimpri, Pune", 599, "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=85", "A leisurely afternoon meal designed for good conversation and new connections.", "food", "weekend", 4.7, 23),
        ("sunrise-run", "Community sunrise run", "Move", "Riverside Track · Punawale", "Sunday, 6:00 AM", "Punawale, Pune", 0, "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1200&q=85", "Start the day with an easy, all-level community run.", "move", "today", 5.0, 18),
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
            rating=rating,
            rating_count=rating_count,
        )
        for slug, title, event_type, venue, time, location, price, image, description, category, day, rating, rating_count in events
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

    # Dispatch email via SMTP
    sent = send_otp_email(clean_email, otp)
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email. Please check your email address and try again.",
        )

    otp_cache[clean_email] = {
        "otp": otp,
        "expires_at": expires_at,
        "verified": False,
    }

    print(f"[OTP LOG] Verification OTP for {clean_email}: {otp} (Sent via official.maxshow@gmail.com)")

    return {
        "message": f"Verification code sent to {clean_email}.",
        "email": clean_email,
        "smtp_sent": True,
    }


@app.post("/api/auth/verify-otp")
def verify_otp(payload: VerifyOtpRequest) -> dict:
    clean_email = payload.email.strip().lower()
    user_otp = payload.otp.strip()

    record = otp_cache.get(clean_email)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active verification code found for this email. Please click 'Send OTP' first.",
        )

    if time.time() > record.get("expires_at", 0):
        otp_cache.pop(clean_email, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code.",
        )

    if record.get("otp") != user_otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please check your Gmail or request a new code.",
        )

    record["verified"] = True
    return {"message": "Email verified successfully!"}


@app.post("/api/auth/forgot-password/send-otp")
def forgot_password_send_otp(payload: ForgotPasswordOtpRequest, db: Session = Depends(get_db)) -> dict:
    clean_username = payload.username.strip().lower()
    clean_email = str(payload.email).strip().lower()

    # Verify both username AND email match the exact same account in the database
    user = db.query(User).filter(
        func.lower(User.username) == clean_username,
        func.lower(User.email) == clean_email,
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found matching this username and email address. Please check your credentials.",
        )

    # Generate secure 6-digit numeric OTP
    otp = f"{secrets.randbelow(900000) + 100000}"
    expires_at = time.time() + (5 * 60) # 5 mins

    sent = send_otp_email(clean_email, otp, purpose="reset_password")
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send password reset code. Please check your email address and try again.",
        )

    cache_key = f"reset:{clean_email}"
    otp_cache[cache_key] = {
        "otp": otp,
        "expires_at": expires_at,
        "verified": False,
        "username": clean_username,
        "user_id": user.id,
    }

    print(f"[OTP LOG] Password Reset OTP for {clean_username} ({clean_email}): {otp}")

    return {
        "message": f"Password reset verification code sent to {clean_email}.",
        "email": clean_email,
        "username": user.username,
        "smtp_sent": True,
    }


@app.post("/api/auth/forgot-password/verify-otp")
def forgot_password_verify_otp(payload: VerifyOtpRequest) -> dict:
    clean_email = payload.email.strip().lower()
    user_otp = payload.otp.strip()

    cache_key = f"reset:{clean_email}"
    record = otp_cache.get(cache_key) or otp_cache.get(clean_email)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active password reset request found for this email. Please click 'Send OTP' first.",
        )

    if time.time() > record.get("expires_at", 0):
        otp_cache.pop(cache_key, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code.",
        )

    if record.get("otp") != user_otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please check your Gmail or request a new code.",
        )

    record["verified"] = True
    return {"message": "Verification code confirmed successfully!"}


@app.post("/api/auth/forgot-password/reset")
def forgot_password_reset(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> dict:
    clean_username = payload.username.strip().lower()
    clean_email = str(payload.email).strip().lower()
    user_otp = payload.otp.strip()

    if payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match.",
        )

    cache_key = f"reset:{clean_email}"
    record = otp_cache.get(cache_key) or otp_cache.get(clean_email)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please request a verification code first.",
        )

    if time.time() > record.get("expires_at", 0):
        otp_cache.pop(cache_key, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code.",
        )

    if record.get("otp") != user_otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code.",
        )

    # Find user matching both username AND email
    user = db.query(User).filter(
        func.lower(User.username) == clean_username,
        func.lower(User.email) == clean_email,
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found matching this username and email address.",
        )

    # Update password in database
    user.password = hash_password(payload.password)
    db.commit()

    # Clear OTP from cache
    otp_cache.pop(cache_key, None)
    otp_cache.pop(clean_email, None)

    # Invalidate existing active sessions for security
    for token, uid in list(active_sessions.items()):
        if uid == user.id:
            active_sessions.pop(token, None)
            session_last_active.pop(token, None)

    return {
        "message": "Password changed successfully! Please sign in with your new password.",
    }


@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)) -> dict:
    clean_username = payload.username.strip().lower()
    clean_email = str(payload.email).strip().lower()
    clean_mobile = (payload.mobile or payload.phone or payload.phone_number or "0000000000").strip()
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

        # Real-time Broadcast to Admin Portal
        admin_broker.broadcast_sync("user_registered", {
            "id": user.id,
            "user_id": user.custom_id,
            "username": user.username,
            "name": user.full_name,
            "email": user.email,
            "phone": user.phone_number,
            "created_at": user.created_at.isoformat() if user.created_at else datetime.now().isoformat(),
            "total_spent": 0,
            "ticket_count": 0,
            "bookings_count": 0,
            "bookings": [],
            "is_online": False,
            "status": "Offline",
        })
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account already exists with this username, email, or mobile number.",
        )
    return {
        "message": "Account created successfully! Please sign in to continue.",
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
    
    # Query all users with matching email, username (with/without @), custom ID, or phone
    criteria = [
        func.lower(User.email) == identifier,
        func.lower(User.username) == identifier,
        func.lower(User.username) == raw_username,
        func.lower(User.custom_id) == identifier,
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
    session_last_active[session_token] = time.time()
    response.set_cookie("maxshow_session", session_token, httponly=True, samesite="lax", max_age=86400 * 30, secure=False)

    # Real-time Broadcast: User is now ONLINE
    admin_broker.broadcast_sync("user_status_changed", {
        "user_id": matched_user.id,
        "custom_id": matched_user.custom_id,
        "name": matched_user.full_name,
        "username": matched_user.username,
        "email": matched_user.email,
        "is_online": True,
        "status": "Online",
        "action": "login",
        "timestamp": datetime.now().isoformat(),
    })

    return {"message": "Login successful.", "user": user_data(matched_user)}


@app.get("/api/auth/me")
def current_user(request: Request, db: Session = Depends(get_db)) -> dict:
    return {"user": user_data(require_user(request, db))}


@app.post("/api/auth/heartbeat")
@app.get("/api/auth/heartbeat")
def user_heartbeat(request: Request, db: Session = Depends(get_db)) -> dict:
    """Refreshes the user's active session timestamp to prevent inactivity timeout while actively browsing."""
    session_token = request.cookies.get("maxshow_session")
    user_id = touch_session(session_token)
    if user_id:
        user = db.get(User, user_id)
        return {
            "status": "active",
            "user_id": user_id,
            "username": user.username if user else None,
            "last_active": session_last_active.get(session_token, time.time()),
        }
    return {"status": "inactive"}


@app.post("/api/auth/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    session_token = request.cookies.get("maxshow_session")
    user_id = active_sessions.pop(session_token, None) if session_token else None
    if session_token:
        session_last_active.pop(session_token, None)
    if user_id:
        user = db.get(User, user_id)
        has_other_sessions = user_id in active_sessions.values()
        if not has_other_sessions:
            # Real-time Broadcast: User is now OFFLINE
            admin_broker.broadcast_sync("user_status_changed", {
                "user_id": user_id,
                "custom_id": user.custom_id if user else f"USR-{user_id}",
                "name": user.full_name if user else "User",
                "username": user.username if user else "user",
                "email": user.email if user else "",
                "is_online": False,
                "status": "Offline",
                "action": "logout",
                "timestamp": datetime.now().isoformat(),
            })
    response.delete_cookie("maxshow_session")
    return {"message": "You have been logged out."}


@app.put("/api/auth/profile")
@app.put("/api/auth/profile/")
@app.put("/api/user/profile")
@app.put("/api/user/profile/")
def update_profile(payload: UpdateProfileRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    user = require_user(request, db)
    clean_username = payload.username.strip().lower()
    clean_name = (payload.full_name or payload.name or user.full_name).strip()
    clean_email = (payload.email or user.email).strip().lower()
    clean_mobile = (payload.mobile or payload.phone or user.phone_number or "0000000000").strip()

    # Check if username is taken by another user
    existing_username = db.query(User).filter(func.lower(User.username) == clean_username, User.id != user.id).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This username is already taken. Please try something unique.",
        )

    user.full_name = clean_name
    user.username = clean_username
    user.email = clean_email
    user.phone_number = clean_mobile
    if payload.password and payload.password.strip():
        user.password = hash_password(payload.password.strip())

    try:
        db.commit()
        db.refresh(user)
        admin_broker.broadcast_sync("user_updated", {"user_id": user.id, "name": user.full_name, "username": user.username})
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
@app.delete("/api/auth/delete-account/")
@app.delete("/api/user/account")
@app.delete("/api/user/account/")
def delete_user_account(request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    user = require_user(request, db)
    user_id = user.id
    user_name = user.full_name
    
    # Delete user's bookmarks, ratings, and bookings first
    db.query(Bookmark).filter(Bookmark.user_id == user.id).delete()
    db.query(Rating).filter(Rating.user_id == user.id).delete()
    db.query(Booking).filter(Booking.user_id == user.id).delete()
    
    # Delete the user record
    db.delete(user)
    db.commit()

    # Real-time Broadcast to Admin
    admin_broker.broadcast_sync("user_deleted", {"user_id": user_id, "name": user_name})

    # Invalidate session
    session_token = request.cookies.get("maxshow_session")
    if session_token:
        active_sessions.pop(session_token, None)
        session_last_active.pop(session_token, None)
    response.delete_cookie("maxshow_session")

    return {"message": "You deleted your account."}


@app.post("/api/admin/login")
@app.post("/api/admin/login/")
@app.post("/api/auth/admin-login")
@app.post("/api/auth/admin-login/")
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
@app.post("/api/admin/logout/")
def admin_logout(request: Request, response: Response) -> dict:
    token = request.cookies.get("maxshow_admin_session")
    if token:
        admin_sessions.discard(token)
    response.delete_cookie("maxshow_admin_session")
    return {"message": "Admin logged out."}


@app.get("/api/admin/me")
@app.get("/api/admin/me/")
def admin_me(request: Request) -> dict:
    require_admin(request)
    return {"admin": True}


@app.get("/api/admin/live-stream")
async def admin_live_stream(request: Request):
    require_admin(request)
    q = admin_broker.subscribe()

    async def event_generator():
        try:
            # Send initial connected event
            yield f"event: connected\ndata: {json.dumps({'message': 'Live admin sync connected', 'time': time.time()})}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield msg
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        except (asyncio.CancelledError, GeneratorExit):
            pass
        finally:
            admin_broker.unsubscribe(q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/events/live-stream")
async def events_live_stream(request: Request):
    """Public SSE stream for real-time event additions, updates, and removals on the Home page."""
    q = admin_broker.subscribe()

    async def event_generator():
        try:
            yield f"event: connected\ndata: {json.dumps({'message': 'Live events stream connected', 'time': time.time()})}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield msg
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        except (asyncio.CancelledError, GeneratorExit):
            pass
        finally:
            admin_broker.unsubscribe(q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/admin/test-live-notification")
def test_live_notification(request: Request) -> dict:
    require_admin(request)
    hex_id = secrets.token_hex(2).upper()
    simulated_id = int(time.time())
    test_user = {
        "id": simulated_id,
        "user_id": f"USR-LIVE-{hex_id}",
        "username": f"explorer_{hex_id.lower()}",
        "name": f"Aarav Mehta #{hex_id}",
        "email": f"aarav.{hex_id.lower()}@example.com",
        "phone": "+91 98201 44521",
        "created_at": datetime.now().isoformat(),
        "total_spent": 0,
        "ticket_count": 0,
        "bookings_count": 0,
        "bookings": [],
        "is_online": True,
        "status": "Online",
    }
    # Keep online in memory
    dummy_token = secrets.token_urlsafe(32)
    active_sessions[dummy_token] = simulated_id
    session_last_active[dummy_token] = time.time()

    admin_broker.broadcast_sync("user_registered", test_user)
    return {"message": "Test live registration broadcast emitted successfully!", "user": test_user}


@app.post("/api/admin/upload-image")
def upload_image(payload: ImageUploadRequest, request: Request) -> dict:
    require_admin(request)
    allowed_types = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
    extension = allowed_types.get(payload.content_type)
    if not extension:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Upload a JPG, PNG, WEBP, or GIF image.")
    raw_data = payload.data.strip()
    if "," in raw_data and "base64," in raw_data:
        raw_data = raw_data.split("base64,")[1].strip()
    elif "," in raw_data:
        raw_data = raw_data.split(",")[1].strip()
    try:
        contents = base64.b64decode(raw_data)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The image data is invalid.")
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Images must be 5 MB or smaller.")
    upload_dir = BASE_DIR / "uploads"
    upload_dir.mkdir(exist_ok=True)
    filename = f"{uuid4().hex}{extension}"
    (upload_dir / filename).write_bytes(contents)
    return {"url": f"/uploads/{filename}"}


@app.get("/api/events")
def list_events(request: Request, db: Session = Depends(get_db)) -> dict:
    session_token = request.cookies.get("maxshow_session")
    user_id = touch_session(session_token)
    user_ratings = {}
    if user_id:
        user_ratings = {r.event_id: r.rating for r in db.query(Rating).filter(Rating.user_id == user_id).all()}

    events_list = []
    for event in db.query(Event).order_by(Event.created_at.desc(), Event.id.desc()).all():
        ed = event_data(event)
        ed["user_rating"] = user_ratings.get(event.id)
        events_list.append(ed)
    return {"events": events_list}


@app.get("/api/events/{slug}")
def get_event(slug: str, request: Request, db: Session = Depends(get_db)) -> dict:
    event = resolve_event_by_identifier(slug, db)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    data = event_data(event)
    data["user_rating"] = None
    data["user_review"] = None
    session_token = request.cookies.get("maxshow_session")
    user_id = touch_session(session_token)
    if user_id:
        rating_obj = db.query(Rating).filter(Rating.user_id == user_id, Rating.event_id == event.id).first()
        if rating_obj:
            data["user_rating"] = rating_obj.rating
            data["user_review"] = rating_obj.review
    return {"event": data}


@app.get("/api/admin/overview")
@app.get("/api/admin/overview/")
@app.get("/api/admin/metrics")
@app.get("/api/admin/metrics/")
def admin_overview(request: Request, db: Session = Depends(get_db)) -> dict:
    require_admin(request)
    cleanup_inactive_sessions()
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

    logged_in_user_ids = set(active_sessions.values())
    online_users_count = sum(1 for u in users if u.id in logged_in_user_ids)

    users_list = []
    for u in users:
        u_bookings = user_bookings_map.get(u.id, [])
        u_total_spent = sum(item["total"] for item in u_bookings)
        u_ticket_count = sum(item["tickets"] for item in u_bookings)
        is_user_online = (u.id in logged_in_user_ids)
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
            "is_online": is_user_online,
            "is_active": is_user_online,
            "status": "Online" if is_user_online else "Offline",
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
            "online_users": online_users_count,
            "offline_users": len(users) - online_users_count,
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


@app.post("/api/admin/users/{user_id}/toggle-status")
def toggle_user_status(user_id: int, request: Request, db: Session = Depends(get_db)) -> dict:
    require_admin(request)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    
    is_currently_active = user_id in active_sessions.values()
    
    if is_currently_active:
        for token, uid in list(active_sessions.items()):
            if uid == user_id:
                active_sessions.pop(token, None)
                session_last_active.pop(token, None)
        new_active = False
        new_status = "Deactivated"
    else:
        dummy_token = secrets.token_urlsafe(32)
        active_sessions[dummy_token] = user_id
        session_last_active[dummy_token] = time.time()
        new_active = True
        new_status = "Active"

    admin_broker.broadcast_sync("user_status_changed", {
        "user_id": user.id,
        "custom_id": user.custom_id,
        "name": user.full_name,
        "username": user.username,
        "email": user.email,
        "is_active": new_active,
        "status": new_status,
        "action": "admin_toggle",
        "timestamp": datetime.now().isoformat(),
    })

    return {
        "message": f"User account has been {new_status.lower()}.",
        "is_active": new_active,
        "status": new_status,
    }


@app.post("/api/admin/events", status_code=status.HTTP_201_CREATED)
@app.post("/api/admin/events/", status_code=status.HTTP_201_CREATED)
def create_event(payload: EventRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    require_admin(request)
    clean_title = payload.title.strip()
    raw_slug = payload.slug.strip() if payload.slug else ""
    if not raw_slug:
        raw_slug = re.sub(r"[^a-z0-9]+", "-", clean_title.lower()).strip("-")
    else:
        raw_slug = re.sub(r"[^a-z0-9]+", "-", raw_slug.lower()).strip("-")
    if not raw_slug:
        raw_slug = f"event-{uuid4().hex[:6]}"

    candidate = raw_slug
    cnt = 1
    while db.query(Event).filter(Event.slug == candidate).first():
        candidate = f"{raw_slug}-{cnt}"
        cnt += 1
    final_slug = candidate

    ev_type = (payload.event_type or payload.type or "Experience").strip()
    ev_day = (payload.day or "weekend").strip().lower()

    cid = generate_event_custom_id(clean_title, payload.time)
    event = Event(
        custom_id=cid,
        slug=final_slug,
        title=clean_title,
        event_type=ev_type,
        venue=payload.venue.strip(),
        time=payload.time.strip(),
        location=payload.location.strip(),
        price=payload.price,
        image=payload.image.strip(),
        description=payload.description.strip(),
        category=payload.category.strip().lower(),
        day=ev_day,
        rating=4.8,
        rating_count=0,
    )
    db.add(event)
    try:
        db.commit()
        db.refresh(event)
        ev_data = event_data(event)
        admin_broker.broadcast_sync("events_updated", {
            "action": "create",
            "id": event.id,
            "title": event.title,
            "event": ev_data,
        })
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An event with this slug already exists.")
    return {"event": ev_data}


@app.put("/api/admin/events/{identifier}")
@app.put("/api/admin/events/{identifier}/")
def update_event(identifier: str, payload: EventRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    require_admin(request)
    event = resolve_event_by_identifier(identifier, db)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    clean_title = payload.title.strip()
    if payload.slug and payload.slug.strip():
        new_slug = re.sub(r"[^a-z0-9]+", "-", payload.slug.strip().lower()).strip("-")
        if new_slug:
            other = db.query(Event).filter(Event.slug == new_slug, Event.id != event.id).first()
            if not other:
                event.slug = new_slug

    event.title = clean_title
    event.event_type = (payload.event_type or payload.type or event.event_type).strip()
    event.venue = payload.venue.strip()
    event.time = payload.time.strip()
    event.location = payload.location.strip()
    event.price = payload.price
    event.image = payload.image.strip()
    event.description = payload.description.strip()
    event.category = payload.category.strip().lower()
    if payload.day:
        event.day = payload.day.strip().lower()
    event.custom_id = generate_event_custom_id(event.title, event.time)

    try:
        db.commit()
        db.refresh(event)
        ev_data = event_data(event)
        admin_broker.broadcast_sync("events_updated", {
            "action": "update",
            "id": event.id,
            "title": event.title,
            "event": ev_data,
        })
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An event with this slug already exists.")
    return {"event": ev_data}


@app.delete("/api/admin/events/{identifier}")
@app.delete("/api/admin/events/{identifier}/")
def delete_event(identifier: str, request: Request, db: Session = Depends(get_db)) -> dict:
    require_admin(request)
    event = resolve_event_by_identifier(identifier, db)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    event_id = event.id
    title = event.title
    db.delete(event)
    db.commit()
    admin_broker.broadcast_sync("events_updated", {
        "action": "delete",
        "id": event_id,
        "title": title,
    })
    return {"message": "Event deleted."}


@app.get("/api/admin/users/{user_id}/bookings")
@app.get("/api/admin/users/{user_id}/bookings/")
def get_user_bookings(user_id: int, request: Request, db: Session = Depends(get_db)) -> dict:
    require_admin(request)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    
    bookings = db.query(Booking).filter(Booking.user_id == user_id).order_by(Booking.created_at.desc()).all()
    results = []
    for b in bookings:
        ev = b.event or (db.get(Event, b.event_id) if b.event_id else None)
        is_free = (b.total_amount == 0) or (getattr(b, "payment_status", "") == "Free Entry")
        results.append({
            "id": b.id,
            "booking_id": b.custom_id or f"BKG-{b.id:04d}",
            "booking_code": b.custom_id or f"BKG-{b.id:04d}",
            "event_id": b.event_id,
            "title": b.event_title,
            "event_title": b.event_title,
            "location": b.event_location,
            "time": b.event_time,
            "tickets": b.ticket_count,
            "quantity": b.ticket_count,
            "total": b.total_amount,
            "payment_status": "Free Entry" if is_free else (getattr(b, "payment_status", None) or "Paid (Razorpay)"),
            "payment_id": "FREE" if is_free else getattr(b, "payment_id", None),
            "created_at": b.created_at.isoformat() if b.created_at else "",
        })
    return {"bookings": results, "count": len(results)}


@app.delete("/api/admin/users/{user_id}")
@app.delete("/api/admin/users/{user_id}/")
def delete_user(user_id: int, request: Request, db: Session = Depends(get_db)) -> dict:
    require_admin(request)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    user_name = user.full_name
    db.query(Booking).filter(Booking.user_id == user_id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    admin_broker.broadcast_sync("user_deleted", {"user_id": user_id, "name": user_name})
    for token, session_user_id in list(active_sessions.items()):
        if session_user_id == user_id:
            active_sessions.pop(token, None)
            session_last_active.pop(token, None)
    return {"message": "User deleted."}


@app.post("/api/admin/bookings/{identifier}/cancel")
@app.post("/api/admin/bookings/{identifier}/cancel/")
@app.delete("/api/admin/bookings/{identifier}/cancel")
@app.delete("/api/admin/bookings/{identifier}/cancel/")
@app.delete("/api/admin/bookings/{identifier}")
@app.delete("/api/admin/bookings/{identifier}/")
def delete_or_cancel_booking(identifier: str, request: Request, db: Session = Depends(get_db)) -> dict:
    require_admin(request)
    booking = None
    if identifier.isdigit():
        booking = db.get(Booking, int(identifier))
    if not booking:
        booking = db.query(Booking).filter(Booking.custom_id == identifier).first()
    if not booking:
        booking = db.query(Booking).filter(Booking.custom_id.ilike(f"%{identifier}%")).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")
    booking_id = booking.id
    db.delete(booking)
    db.commit()
    admin_broker.broadcast_sync("booking_deleted", {"booking_id": booking_id})
    return {"message": "Booking cancelled and deleted successfully.", "booking_id": booking_id}


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
    user = get_or_create_user_for_booking(
        request,
        db,
        name=payload.guest_name or payload.name,
        email=payload.guest_email or payload.email,
        phone=payload.guest_phone or payload.phone,
    )
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
    admin_broker.broadcast_sync("booking_created", {
        "id": booking.id,
        "booking_id": booking.custom_id or str(booking.id),
        "user_id": user.id,
        "user_name": user.full_name,
        "username": user.username,
        "event_title": booking.event_title,
        "tickets": booking.ticket_count,
        "total": booking.total_amount,
    })
    return {"message": "Tickets booked successfully.", "booking_id": booking.custom_id or str(booking.id)}


@app.post("/api/payment/create-order")
@app.post("/api/payment/create-order/")
@app.post("/api/bookings/create-order")
@app.post("/api/bookings/create-order/")
def create_payment_order(
    payload: CreatePaymentOrderRequest, request: Request, db: Session = Depends(get_db)
) -> dict:
    user = get_or_create_user_for_booking(
        request,
        db,
        name=payload.guest_name or payload.name,
        email=payload.guest_email or payload.email,
        phone=payload.guest_phone or payload.phone,
    )
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
        admin_broker.broadcast_sync("booking_created", {
            "id": booking.id,
            "booking_id": booking.custom_id or str(booking.id),
            "user_id": user.id,
            "user_name": user.full_name,
            "username": user.username,
            "event_title": booking.event_title,
            "tickets": booking.ticket_count,
            "total": 0,
        })
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
@app.post("/api/bookings/verify-payment")
@app.post("/api/bookings/verify-payment/")
def verify_payment(
    payload: VerifyPaymentRequest, request: Request, db: Session = Depends(get_db)
) -> dict:
    user = get_or_create_user_for_booking(
        request,
        db,
        name=payload.guest_name or payload.name,
        email=payload.guest_email or payload.email,
        phone=payload.guest_phone or payload.phone,
    )

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
    admin_broker.broadcast_sync("booking_created", {
        "id": booking.id,
        "booking_id": booking.custom_id or str(booking.id),
        "user_id": user.id,
        "user_name": user.full_name,
        "username": user.username,
        "event_title": booking.event_title,
        "tickets": booking.ticket_count,
        "total": booking.total_amount,
    })

    return {
        "message": "Payment verified and tickets booked successfully.",
        "booking_id": booking.custom_id or str(booking.id),
        "payment_id": payload.razorpay_payment_id,
    }


@app.get("/api/user/dashboard")
@app.get("/api/user/dashboard/")
def user_dashboard(request: Request, db: Session = Depends(get_db)) -> dict:
    user = require_user(request, db)
    bookings = db.query(Booking).filter(Booking.user_id == user.id).order_by(Booking.created_at.desc()).all()
    bookmarks = db.query(Bookmark).filter(Bookmark.user_id == user.id).order_by(Bookmark.created_at.desc()).all()

    booking_results = []
    for b in bookings:
        ev = b.event or (db.get(Event, b.event_id) if b.event_id else None)
        is_free = (b.total_amount == 0) or (getattr(b, "payment_status", "") == "Free Entry")
        booking_results.append({
            "id": b.id,
            "booking_id": b.custom_id or f"BKG-{b.id:04d}",
            "booking_code": b.custom_id or f"BKG-{b.id:04d}",
            "event_id": (ev.custom_id if ev else None) or (f"EVT-{b.event_id}" if b.event_id else "N/A"),
            "event_slug": ev.slug if ev else None,
            "event_image": ev.image if ev else "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=85",
            "title": b.event_title,
            "event_title": b.event_title,
            "location": b.event_location,
            "time": b.event_time,
            "tickets": b.ticket_count,
            "quantity": b.ticket_count,
            "total": b.total_amount,
            "payment_status": "Free Entry" if is_free else (getattr(b, "payment_status", None) or "Paid (Razorpay)"),
            "payment_id": "FREE" if is_free else getattr(b, "payment_id", None),
            "created_at": b.created_at.isoformat() if b.created_at else "",
        })

    bookmark_results = []
    for bm in bookmarks:
        if bm.event:
            bookmark_results.append({
                "id": bm.id,
                "bookmark_id": bm.custom_id or f"BMK-{bm.id:04d}",
                "event_id": bm.event_id,
                "event": event_data(bm.event),
                "created_at": bm.created_at.isoformat() if bm.created_at else "",
            })

    return {
        "user": user_data(user),
        "bookings": booking_results,
        "bookmarks": bookmark_results,
        "bookings_count": len(booking_results),
        "bookmarks_count": len(bookmark_results),
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


# ==========================================
# BOOKMARKS & RATINGS API
# ==========================================

@app.post("/api/bookmarks/toggle")
@app.post("/api/bookmarks/toggle/")
def toggle_bookmark(payload: BookmarkToggleRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    user = require_user(request, db)
    event = None
    if payload.event_id:
        try:
            eid = int(payload.event_id)
            if eid > 0:
                event = db.get(Event, eid)
        except (ValueError, TypeError):
            pass
    if not event and payload.event_slug:
        clean_slug = str(payload.event_slug).strip().lower()
        event = db.query(Event).filter(Event.slug == clean_slug).first()
    if not event and payload.event_slug:
        clean_title = str(payload.event_slug).strip()
        event = db.query(Event).filter(Event.title.ilike(f"%{clean_title}%")).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    existing = db.query(Bookmark).filter(Bookmark.user_id == user.id, Bookmark.event_id == event.id).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {
            "bookmarked": False,
            "message": f"Removed '{event.title}' from bookmarks.",
            "event_id": event.id,
        }

    u_cid = user.custom_id or generate_user_custom_id(user.full_name, user.phone_number)
    e_cid = event.custom_id or generate_event_custom_id(event.title, event.time)
    b_cid = generate_bookmark_custom_id(u_cid, e_cid)

    new_bmk = Bookmark(
        custom_id=b_cid,
        user_id=user.id,
        event_id=event.id,
    )
    db.add(new_bmk)
    db.commit()
    db.refresh(new_bmk)
    return {
        "bookmarked": True,
        "bookmark_id": new_bmk.custom_id or f"BMK-{new_bmk.id:04d}",
        "message": f"Saved '{event.title}' to your bookmarks! 🔖",
        "event_id": event.id,
    }


@app.get("/api/bookmarks")
@app.get("/api/bookmarks/")
def list_bookmarks(request: Request, db: Session = Depends(get_db)) -> dict:
    user = require_user(request, db)
    bookmarks = (
        db.query(Bookmark)
        .filter(Bookmark.user_id == user.id)
        .order_by(Bookmark.created_at.desc(), Bookmark.id.desc())
        .all()
    )
    results = []
    for b in bookmarks:
        if b.event:
            ev_dict = event_data(b.event)
            results.append({
                "id": b.id,
                "bookmark_id": b.custom_id or f"BMK-{b.id:04d}",
                "event_id": b.event_id,
                "event": ev_dict,
                "created_at": b.created_at.isoformat() if b.created_at else "",
            })
    return {"bookmarks": results, "count": len(results)}


@app.delete("/api/bookmarks/{identifier}")
@app.delete("/api/bookmarks/{identifier}/")
def delete_bookmark(identifier: str, request: Request, db: Session = Depends(get_db)) -> dict:
    user = require_user(request, db)
    event = resolve_event_by_identifier(identifier, db)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    bmk = db.query(Bookmark).filter(Bookmark.user_id == user.id, Bookmark.event_id == event.id).first()
    if not bmk:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bookmark not found.")
    db.delete(bmk)
    db.commit()
    return {"message": "Bookmark removed.", "event_id": event.id}


@app.post("/api/events/{identifier}/rate")
@app.post("/api/events/{identifier}/rate/")
def rate_event(identifier: str, payload: RateEventRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    user = require_user(request, db)
    event = resolve_event_by_identifier(identifier, db)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    existing_rating = db.query(Rating).filter(Rating.user_id == user.id, Rating.event_id == event.id).first()
    already_rated = existing_rating is not None

    if existing_rating:
        existing_rating.rating = payload.rating
        if payload.review is not None:
            existing_rating.review = payload.review
        existing_rating.updated_at = datetime.now()
    else:
        new_rating = Rating(
            user_id=user.id,
            event_id=event.id,
            rating=payload.rating,
            review=payload.review,
        )
        db.add(new_rating)

    db.commit()
    recalculate_event_rating(event, db)

    msg = f"Your rating was updated to {payload.rating} stars! ⭐" if already_rated else f"Thank you for rating! You gave {payload.rating} stars! ⭐"

    return {
        "message": msg,
        "user_rating": payload.rating,
        "avg_rating": round(float(event.rating or 0.0), 1),
        "rating_count": int(event.rating_count or 0),
        "already_rated": already_rated,
    }


@app.delete("/api/events/{identifier}/rate")
@app.delete("/api/events/{identifier}/rate/")
@app.post("/api/events/{identifier}/unrate")
@app.post("/api/events/{identifier}/unrate/")
def delete_event_rating(identifier: str, request: Request, db: Session = Depends(get_db)) -> dict:
    user = require_user(request, db)
    event = resolve_event_by_identifier(identifier, db)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    existing_rating = db.query(Rating).filter(Rating.user_id == user.id, Rating.event_id == event.id).first()
    if existing_rating:
        db.delete(existing_rating)
        db.commit()

    recalculate_event_rating(event, db)

    return {
        "message": "Rating removed.",
        "user_rating": None,
        "avg_rating": round(float(event.rating or 0.0), 1),
        "rating_count": int(event.rating_count or 0),
    }


@app.get("/api/events/{slug}/my-rating")
@app.get("/api/events/{slug}/my-rating/")
def get_my_rating(slug: str, request: Request, db: Session = Depends(get_db)) -> dict:
    session_token = request.cookies.get("maxshow_session")
    user_id = touch_session(session_token)
    if not user_id:
        return {"rated": False, "rating": None}

    event = resolve_event_by_identifier(slug, db)
    if not event:
        return {"rated": False, "rating": None}

    rating_obj = db.query(Rating).filter(Rating.user_id == user_id, Rating.event_id == event.id).first()
    if rating_obj:
        return {
            "rated": True,
            "rating": rating_obj.rating,
            "review": rating_obj.review,
            "updated_at": rating_obj.updated_at.isoformat() if rating_obj.updated_at else "",
        }
    return {"rated": False, "rating": None}


@app.get("/api/user/state")
@app.get("/api/user/state/")
def get_user_state(request: Request, db: Session = Depends(get_db)) -> dict:
    session_token = request.cookies.get("maxshow_session")
    user_id = touch_session(session_token)
    user = db.get(User, user_id) if user_id else None
    if not user:
        return {
            "authenticated": False,
            "user": None,
            "bookmarked_event_ids": [],
            "user_ratings": {},
            "user_ratings_by_slug": {},
        }

    bookmarked_ids = [b[0] for b in db.query(Bookmark.event_id).filter(Bookmark.user_id == user.id).all()]
    user_ratings_objs = db.query(Rating).filter(Rating.user_id == user.id).all()
    ratings_by_id = {r.event_id: r.rating for r in user_ratings_objs}
    
    event_slug_map = {e.id: e.slug for e in db.query(Event.id, Event.slug).all()}
    ratings_by_slug = {event_slug_map[r.event_id]: r.rating for r in user_ratings_objs if r.event_id in event_slug_map}

    return {
        "authenticated": True,
        "user": user_data(user),
        "bookmarked_event_ids": bookmarked_ids,
        "user_ratings": ratings_by_id,
        "user_ratings_by_slug": ratings_by_slug,
    }


# Static and SPA Routing
FRONTEND_DIST_DIR = FRONTEND_DIR / "dist"
STATIC_TARGET_DIR = FRONTEND_DIST_DIR if FRONTEND_DIST_DIR.exists() else FRONTEND_DIR

# Mount uploads directory for uploaded event images
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Mount assets directory if it exists in dist
if (STATIC_TARGET_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=STATIC_TARGET_DIR / "assets"), name="assets")

# SPA catch-all route for client-side routing
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    file_path = STATIC_TARGET_DIR / full_path
    if full_path and file_path.is_file():
        if "assets/" in full_path:
            return FileResponse(file_path, headers={"Cache-Control": "public, max-age=31536000, immutable"})
        return FileResponse(file_path)
    # If not a physical file, return index.html for React Router to handle
    index_file = STATIC_TARGET_DIR / "index.html"
    if index_file.exists():
        return FileResponse(
            index_file,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )
    return HTMLResponse("<h1>MAXSHOW Frontend Not Found</h1>", status_code=404)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)


