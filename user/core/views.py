from aiohttp import web
import json

from sqlalchemy.exc import IntegrityError

from user.core.logic import registration


async def home_page_view(request):
    data = await request.json()
    try:
        user = await registration(data['username'], data['password'])
    except IntegrityError:
        response_obj = {
            'status': 'Error',
            'massage': 'This username is used'
        }
        return web.Response(text=json.dumps(response_obj), status=400)
    response_obj = {
        'status': 'Ok',
        'user_name': user['username']
    }
    return web.Response(text=json.dumps(response_obj), status=200)
