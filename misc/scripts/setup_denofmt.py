#!/usr/bin/env python3

import argparse
import os
import platform
import shutil
import stat
import subprocess
import sys
import urllib.request
from hashlib import sha256
from os import chmod, unlink
from pathlib import Path
from textwrap import dedent
from typing import List, Union
from zipfile import ZipFile


def get_deno_release_filename() -> Union[str, None]:
    platform_architecture = platform.architecture()[0]
    if platform_architecture != "64bit":
        return None

    platform_system = platform.system()
    platform_machine = platform.machine()

    if platform_system == "Windows":
        if not platform_machine == "x86_64":
            return None
        return "deno-x86_64-pc-windows-msvc.zip"
    elif platform.mac_ver()[0] != "":
        if platform_machine == "x86_64":
            return "deno-x86_64-apple-darwin.zip"
        elif platform_machine == "arm64":
            return "deno-aarch64-apple-darwin.zip"
        else:
            return None
    elif platform_system == "Linux":
        if platform_machine == "x86_64":
            return "deno-x86_64-unknown-linux-gnu.zip"
        elif platform_machine == "arm64":
            return "deno-aarch64-unknown-linux-gnu.zip"
        else:
            return None

    return None


def get_deno_path(precommit_repo: Path, verbose=False, bypass_local_deno=False) -> Union[Path, None]:
    which_deno = shutil.which("deno")
    if which_deno is not None:
        if bypass_local_deno:
            if verbose:
                print(f"Bypassing `{which_deno}` as `bypass_local` is `True`")
        return Path(which_deno)

    deno_exec: Path
    if platform.platform() == "Windows":
        deno_exec = precommit_repo.joinpath("deno.exe")
    else:
        deno_exec = precommit_repo.joinpath("deno")

    if deno_exec.exists():
        return deno_exec

    return None


def install_deno(precommit_repo: Path, verbose=False) -> None:
    deno_filename = get_deno_release_filename()
    if deno_filename is None:
        message = """
            Could not find a Deno release binary.
            Please install Deno by following these instructions: https://docs.deno.com/runtime/getting_started/installation/
        """
        print(
            dedent(message).strip(),
            file=sys.stderr,
        )
        exit(1)

    sha256sum_filename = f"{deno_filename}.sha256sum"
    github_latest_url = "https://github.com/denoland/deno/releases/latest/download/{0}"

    deno_url = github_latest_url.format(deno_filename)
    sha256sum_url = github_latest_url.format(sha256sum_filename)

    deno_zip = precommit_repo.joinpath(deno_filename)
    deno_exec_name: str
    if platform.platform() == "Windows":
        deno_exec_name = "deno.exe"
    else:
        deno_exec_name = "deno"
    deno_exec = precommit_repo.joinpath(deno_exec_name)

    sha256sum = ""
    try:
        if verbose:
            print(f'Downloading "{sha256sum_url}"')
        with urllib.request.urlopen(sha256sum_url) as uf:
            sha256sum = uf.read().decode("utf-8")[:64]
    except urllib.request.HTTPError as err:
        print(f"HTTP {err.getcode()} error while downloading sha256 sum", file=sys.stderr)

    try:
        if verbose:
            print(f'Downloading "{deno_url}"')
        with urllib.request.urlopen(deno_url) as uf:
            data = uf.read()
            if sha256sum != sha256(data).hexdigest():
                print(
                    "sha256sum failed: downloaded Deno package is corrupted",
                    file=sys.stderr,
                )
                exit(1)
            with open(deno_zip, "wb") as f:
                f.write(data)
    except urllib.request.HTTPError as err:
        print(
            f"HTTP {err.getcode()} error while downloading Deno package",
            file=sys.stderr,
        )

    with ZipFile(deno_zip, "r") as zf:
        with zf.open(deno_exec_name, "r") as df:
            with open(deno_exec, "wb") as f:
                f.write(df.read())

    unlink(deno_zip)
    deno_exec_stat = os.stat(deno_exec)
    chmod(deno_exec, deno_exec_stat.st_mode | stat.S_IEXEC)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="pre-commit utility to run denofmt")
    parser.add_argument(
        "file_to_format",
        nargs="+",
        type=Path,
        help="path to the file to format by denofmt",
    )
    parser.add_argument("-V", "--verbose", dest="verbose", action="store_true", help="toggle verbosity")
    parser.add_argument(
        "-f",
        "--force",
        dest="force",
        action="store_true",
        help="bypass pre-commit check",
    )
    parser.add_argument(
        "-b",
        "--bypass-local-deno",
        dest="bypass_local_deno",
        action="store_true",
        help="bypass local deno to use pre-commit downloaded one",
    )
    args = parser.parse_args()

    verbose: bool = args.verbose
    file_to_format: List[str] = args.file_to_format
    force: bool = args.force
    bypass_local_deno: bool = args.bypass_local_deno

    precommit_repo = Path(sys.executable).parent.parent.parent
    precommit_dir = precommit_repo.parent
    if precommit_dir.name != "pre-commit" and not args.force:
        print(
            "This script is intended to be used by pre-commit, refusing to execute.",
            file=sys.stderr,
        )

    deno_path = get_deno_path(precommit_repo, verbose=verbose, bypass_local_deno=bypass_local_deno)
    if deno_path is None:
        install_deno(precommit_repo, verbose)
        deno_path = get_deno_path(precommit_repo, verbose=verbose, bypass_local_deno=bypass_local_deno)
    if deno_path is None:
        print("Something went wrong, `deno_path` is `None`", file=sys.stderr)
        exit(1)

    result = subprocess.run(
        [
            str(deno_path),
            "--allow-run",
            "--allow-read",
            "misc/scripts/run_denofmt.ts",
        ]
        + file_to_format,
        capture_output=True,
    )
    if result.returncode == 0:
        exit(0)

    print(result.stderr.decode("utf-8"), file=sys.stderr)
    exit(1)
