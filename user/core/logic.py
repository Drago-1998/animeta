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
