from user.core.views import home_page_view


def setup_routes(app):
    app.router.add_post('/', home_page_view)
