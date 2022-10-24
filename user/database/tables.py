from datetime import datetime

from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base

from passlib.context import CryptContext


PASSLIB_CONTEXT = CryptContext(
    # in a new application with no previous schemes, start with pbkdf2 SHA512
    schemes=["pbkdf2_sha512"],
)


class _BaseModel(object):
    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


BaseModel = declarative_base(cls=_BaseModel)


class User(BaseModel):
    __tablename__ = 'user'

    username = Column(String(255), nullable=False, unique=True)
    first_name = Column(String(255), nullable=True)
    second_name = Column(String(255), nullable=True)
    active = Column(Boolean, default=False)

    password_hash = Column(String(256), nullable=False)

    def __init__(self, password=None, password_hash=None, **kwargs):
        if password_hash is None and password is not None:
            password_hash = self.generate_hash(password)
        super().__init__(password_hash=password_hash, **kwargs)

    @property
    def password(self):
        raise AttributeError("User.password is write-only")

    @password.setter
    def password(self, password):
        self.password_hash = self.generate_hash(password)

    def verify_password(self, password):
        return PASSLIB_CONTEXT.verify(password, self.password_hash)

    @staticmethod
    def generate_hash(password):
        """Generate a secure password hash from a new password"""
        return PASSLIB_CONTEXT.hash(password.encode("utf8"))
