from aiohttp import web

from user.core.routes import setup_routes
from user.settings.base_settings import config


app = web.Application()
setup_routes(app)
app['config'] = config
web.run_app(app, port=8000)
