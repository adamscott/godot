import importlib.util
import subprocess
import sys
from typing import List


def query_non_installed_dependencies() -> List[str]:
    missing_dependencies = []

    def check_dep(module_name: str, dep: str) -> List[str]:
        spec = importlib.util.find_spec(module_name)
        if spec is None:
            return [dep]
        return []

    missing_dependencies += check_dep("SCons", "scons")
    missing_dependencies += check_dep("prompt_toolkit", "prompt_toolkit")

    return missing_dependencies


def query_dependencies_install(dependencies: List[str]) -> bool:
    print(f"Dependencies {",".join([f"`{x}`" for x in dependencies])} are not installed.")
    try:
        response = input(f"Install Python package(s) {",".join([f"`{x}`" for x in dependencies])}? (Y/n) ")

        if len(response) == 0:
            return True

        return response.lower() == "y"
    except KeyboardInterrupt:
        exit(0)


def install_dependencies(dependencies: List[str]) -> None:
    subprocess.check_call([sys.executable, "-m", "pip", "install"] + dependencies)
