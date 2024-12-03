#!/usr/bin/env python3
import argparse
import importlib
import sys

from misc.customize.install_dependencies import (
    install_dependencies,
    query_dependencies_install,
    query_non_installed_dependencies,
)


def main() -> None:
    parser = parse_args()

    if parser.interactive:
        non_installed_dependencies = query_non_installed_dependencies()
        if len(non_installed_dependencies) > 0:
            if query_dependencies_install(non_installed_dependencies):
                install_dependencies(non_installed_dependencies)
            else:
                exit(0)

        gui = importlib.import_module("misc.customize.gui")
        gui.start()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("-i", "--interactive", help="launches the interactive custom.py builder", action="store_true")

    # Make sure that if no args have been passed, that `--help` is triggered.
    args = parser.parse_args(args=None if sys.argv[1:] else ["--help"])

    return args


if __name__ == "__main__":
    main()
