from sqlalchemy.orm import sessionmaker

from user.settings.base_settings import DATABASE_ENGINE


async def get_db_session():
    Session = sessionmaker(bind=DATABASE_ENGINE)
    session = Session()
    return session
