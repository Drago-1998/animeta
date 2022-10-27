from aiohttp import web
import json

from sqlalchemy.exc import IntegrityError

from user.core.logic import registration, login


async def registration_endpoint(request):
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
        'user': user
    }
    return web.Response(text=json.dumps(response_obj), status=200)


async def login_endpoint(request):
    data = await request.json()
    user = await login(data['username'], data['password'])


    response_obj = {
        'status': 'Ok',
        'user': user
    }
    return web.Response(text=json.dumps(response_obj), status=200)
