import jwt

from user.core.helpers import get_db_session
from user.database.tables import User
from user.settings.base_settings import JWT_PRIVATE_KEY, JWT_PUBLIC_KEY


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
    jw_token = await create_jwt(user)
    return {
        'username': user.username,
        'json_web_token': jw_token
    }


async def login(username: str,
                password: str) -> dict:
    session = await get_db_session()
    user = session.query(User).filter(User.username == username).first()
    if not user:
        raise ValueError('User not found')
    elif not user.verify_password(password):
        raise ValueError('Wrong password')
    session.commit()
    jw_token = await create_jwt(user)
    return {
        'username': user.username,
        'first_name': user.first_name,
        'second_name': user.second_name,
        'json_web_token': jw_token
    }


async def create_jwt(user: User) -> str:
    jw_token = jwt.encode(
        {
            "user": {
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'second_name': user.second_name,
            }
        },
        JWT_PRIVATE_KEY,
        algorithm="RS256"
    )
    return jw_token


async def read_jwt(jw_token: str) -> dict:
    return jwt.decode(
        jw_token,
        JWT_PUBLIC_KEY,
        algorithms=["RS256"]
    )
