#!/usr/bin/env python3
import argparse
import importlib
import sys

from misc.customize.install_dependencies import (
    are_dependencies_installed,
    install_dependencies,
    query_dependencies_install,
)


def main() -> None:
    parser = parse_args()

    if parser.interactive:
        if not are_dependencies_installed():
            print("Python package `prompt_toolkit` not detected.")
            if query_dependencies_install():
                install_dependencies()
            else:
                print(
                    "`prompt_toolkit` is needed to use customize.py. (you can install it manually using `pip install unicurses`)"
                )

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
