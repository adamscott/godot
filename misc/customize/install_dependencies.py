import importlib.util
import subprocess
import sys


def are_dependencies_installed() -> bool:
    spec = importlib.util.find_spec("prompt_toolkit")
    return spec is not None


def query_dependencies_install() -> bool:
    try:
        response = input("Install Python package `prompt_toolkit`? (Y/n) ")

        if len(response) == 0:
            return True

        return response.lower() == "y"
    except KeyboardInterrupt:
        exit(0)


def install_dependencies() -> None:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "prompt_toolkit"])
