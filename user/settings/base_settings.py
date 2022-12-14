import pathlib

import yaml
from sqlalchemy import create_engine


BASE_DIR = pathlib.Path(__file__).parent.parent
config_path = BASE_DIR / 'config' / 'dev_conf.yaml'


def get_config(path):
    with open(path) as f:
        loaded_config = yaml.safe_load(f)
    return loaded_config


config = get_config(config_path)

# Database Config
DSN = "postgresql://{user}:{password}@{host}:{port}/{database}"
db_url = DSN.format(**config['postgres'])
DATABASE_ENGINE = create_engine(db_url)

# JWT Config
jwt_private_file = open("user/config/private.key", "r")
jwt_public_file = open("user/config/public.key", "r")
JWT_PRIVATE_KEY = jwt_private_file.read().encode('ascii')
JWT_PUBLIC_KEY = jwt_public_file.read().encode('ascii')
