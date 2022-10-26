from sqlalchemy import select

from user.core.helpers import get_db_session
from user.database.tables import User


async def registration(username: str,
                       password: str,
                       first_name: str = None,
                       second_name: str = None) -> dict:
    session = await get_db_session()
    user = User(username=username,
                first_name=first_name,
                second_name=second_name)
    user.password = password
    session.add(user)
    session.commit()
    return {'username': user.username}


async def login(username: str,
                password: str) -> dict:
    session = await get_db_session()
    user = session.query(User).filter(User.username == username).first()
    if not user:
        raise ValueError('User not found')
    elif not user.verify_password(password):
        raise ValueError('Wrong password')
    session.commit()
    return {'username': user.username,
            'first_name': user.first_name,
            'second_name': user.second_name}
