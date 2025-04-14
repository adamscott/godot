import os.path

from SCons.Util import splitext


def install_builders(env):
    env.Append(
        BUILDERS={
            "UnTar": env.Builder(
                action=env.Action(tar_untar, tar_untar_string),
                src_suffix=".tar.gz",
                emitter=tar_contents_emitter,
            )
        }
    )


"""
UnTarBuilder
See https://github.com/SCons/scons/wiki/UnTarBuilder
"""


def tar_contents_emitter(target, source, env):
    import tarfile

    one_top_level = tar_is_one_top_level(env)

    new_targets = []
    for s in source:
        source_path = str(s)
        extraction_path = tar_get_extraction_path(source_path, one_top_level)
        source_tar = tarfile.open(source_path, "r")
        tar_contents = source_tar.getmembers()
        tar_file_contents = filter(lambda tar_entry: tar_entry.isfile(), tar_contents)
        new_targets += list(
            map(
                lambda tar_info_object: env.File(os.path.join(extraction_path, tar_info_object.name)), tar_file_contents
            )
        )
        source_tar.close()
    return (new_targets, source)


def tar_is_one_top_level(env):
    if "one_top_level" not in env:
        return False
    return bool(env["one_top_level"])


def tar_get_path_without_extension(path):
    if path.endswith(".tar.gz"):
        return path.removesuffix(".tar.gz")
    return splitext(path)[0]


def tar_get_extraction_path(path, one_top_level):
    path_without_extension = tar_get_path_without_extension(path)
    path_dir_name = os.path.dirname(path_without_extension)
    return path_without_extension if one_top_level else path_dir_name


def tar_untar(target, source, env):
    import tarfile

    one_top_level = tar_is_one_top_level(env)

    for s in source:
        source_path = str(s)
        extraction_path = tar_get_extraction_path(source_path, one_top_level)
        source_tar = tarfile.open(source_path, "r")
        source_tar.extractall(path=extraction_path)
        source_tar.close()
    return None


def tar_untar_string(target, source, env):
    print(source)
    return f"Extracting {os.path.basename(str(source[0]))}"
