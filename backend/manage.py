#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
from pathlib import Path
import secrets
import sys


def configure_local_environment():
    if os.environ.get('DJANGO_DEBUG', '').lower() in {'0', 'false', 'no'}:
        return

    os.environ.setdefault('DJANGO_DEBUG', 'true')
    if os.environ.get('DJANGO_SECRET_KEY'):
        return

    key_path = Path(__file__).resolve().parent / '.django_secret_key'
    try:
        with key_path.open('x', encoding='utf-8') as key_file:
            key_file.write(secrets.token_urlsafe(50))
        print('Created a local development secret key in backend/.django_secret_key.')
    except FileExistsError:
        pass

    secret_key = key_path.read_text(encoding='utf-8').strip()
    if not secret_key:
        raise RuntimeError(
            f'The local secret key file {key_path} is empty. Delete it and rerun this command.'
        )
    os.environ['DJANGO_SECRET_KEY'] = secret_key


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    configure_local_environment()
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
