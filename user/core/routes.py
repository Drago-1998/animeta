from user.core.views import registration_endpoint, login_endpoint


def setup_routes(app):
    app.router.add_post('/registration/', registration_endpoint)
    app.router.add_post('/login/', login_endpoint)
