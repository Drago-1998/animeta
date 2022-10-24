from sqlalchemy import create_engine
from sqlalchemy.sql import Insert

from database.tables import User
from settings.base_settings import config, DATABASE_ENGINE


def create_tables(db_engine):
    User.metadata.create_all(db_engine)


if __name__ == '__main__':
    create_tables(DATABASE_ENGINE)
