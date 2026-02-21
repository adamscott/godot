"""Functions used to generate scu build source files during build time"""

import glob
import math
import os
from pathlib import Path

from methods import print_error

base_dir_path = Path(__file__).parent
base_dir_name = base_dir_path.name
_verbose = False  # Set manually for debug prints.
_scu_directories = set()
_max_includes_per_scu = 1024


def clear_out_stale_files(output_dir, extension, fresh_files):
    output_dir_path = Path(output_dir)
    # print("clear_out_stale_files from directory: " + output_dir_path)

    if not output_dir_path.is_dir():
        # Directory does not exist or has not been created yet,
        # no files to clearout. (this is not an error.)
        return

    for file in glob.glob(output_dir_path.joinpath("*." + extension).as_posix()):
        file_path = output_dir_path.joinpath(file)
        if file_path not in fresh_files:
            # print("removed stale file: " + str(file))
            os.remove(file_path)


def is_dir(dir):
    abs_dir_path = base_dir_path.joinpath(dir)
    return abs_dir_path.is_dir()


def find_files_in_directory(dir_path, extension, sought_exceptions):
    dir_path = Path(dir_path)
    include_list = []
    found_exceptions = []

    if not dir_path.is_dir():
        print_error(f'SCU: "{dir_path.as_posix()}" not found.')
        return

    current_cwd = os.getcwd()
    os.chdir(dir_path)
    for file in glob.glob("*." + extension):
        file_path = dir_path.joinpath(file)
        simple_name = file_path.stem

        if file_path.name.endswith(".gen.cpp"):
            continue

        if simple_name not in sought_exceptions:
            include_list.append(file_path)
        else:
            found_exceptions.append(file_path)
    os.chdir(current_cwd)

    return include_list, found_exceptions


def write_output_file(
    file_count, include_list, start_line, end_line, output_dir_path, output_filename_prefix, extension
):
    output_dir_path = Path(output_dir_path)

    if not output_dir_path.is_dir():
        # create
        os.mkdir(output_dir_path)
        if not output_dir_path.is_dir():
            print_error(f'SCU: "{output_dir_path}" could not be created.')
            return
        if _verbose:
            print("SCU: Creating directory: %s" % output_dir_path)

    file_text = ""

    for i in range(start_line, end_line):
        if i < len(include_list):
            line = f'#include "{include_list[i].as_posix()}"\n'
            file_text += line

    num_string = ""
    if file_count > 0:
        num_string = "_" + str(file_count)

    short_filename = output_filename_prefix + num_string + ".gen." + extension
    output_path = output_dir_path.joinpath(short_filename)

    if not output_path.exists() or output_path.read_text() != file_text:
        if _verbose:
            print("SCU: Generating: %s" % short_filename)
        output_path.write_text(file_text, encoding="utf8")
    elif _verbose:
        print("SCU: Generation not needed for: " + short_filename)

    return output_path


def write_exception_output_file(file_count, exception_path, output_dir_path, output_filename_prefix, extension):
    output_dir_path = Path(output_dir_path)
    if not output_dir_path.is_dir():
        print_error(f"SCU: {output_dir_path} does not exist.")
        return

    file_text = f'#include "{exception_path.as_posix()}"\n'

    num_string = ""
    if file_count > 0:
        num_string = "_" + str(file_count)

    short_filename = output_filename_prefix + "_exception" + num_string + ".gen." + extension
    output_path = output_dir_path.joinpath(short_filename)

    if not output_path.exists() or output_path.read_text() != file_text:
        if _verbose:
            print("SCU: Generating: " + short_filename)
        output_path.write_text(file_text, encoding="utf8")
    elif _verbose:
        print("SCU: Generation not needed for: " + short_filename)

    return output_path


# Construct a useful name for the section from the path for debug logging
def find_section_name(dir_path):
    dir_path = Path(dir_path)
    if dir_path.is_absolute():
        dir_path = base_dir_path.joinpath(dir_path.as_posix()[1:])

    relative_path = base_dir_path.joinpath(dir_path).relative_to(base_dir_path)
    return relative_path.as_posix().replace("/", "_")


# "dirs" is a list of directories to add all the files from to add to the SCU
# "section (like a module)". The name of the scu file will be derived from the first directory
# (thus e.g. scene/3d becomes scu_scene_3d.gen.cpp)

# "includes_per_scu" limits the number of includes in a single scu file.
# This allows the module to be built in several translation units instead of just 1.
# This will usually be slower to compile but will use less memory per compiler instance, which
# is most relevant in release builds.

# "sought_exceptions" are a list of files (without extension) that contain
# e.g. naming conflicts, and are therefore not suitable for the scu build.
# These will automatically be placed in their own separate scu file,
# which is slow like a normal build, but prevents the naming conflicts.
# Ideally in these situations, the source code should be changed to prevent naming conflicts.


# "extension" will usually be cpp, but can also be set to c (for e.g. third party libraries that use c)
def process_directory(
    dir_to_find,
    *,
    additional_dirs=[],
    sought_exceptions=[],
    includes_per_scu=0,
    extension="cpp",
    files_to_put_first=[],
):
    dir_path = Path(dir_to_find)

    global base_dir_path

    # Construct the filename prefix from the directory name.
    # e.g. "scene_3d".
    out_filename = find_section_name(dir_path)

    found_includes = []
    found_exceptions = []

    abs_main_dir_path = base_dir_path.joinpath(dir_path)

    # Keep a record of all directories that have been processed for SCU,
    # this enables deciding what to do when we call "add_source_files()".
    global _scu_directories
    _scu_directories.add(dir_path)

    for dir_to_find in [dir_path, *additional_dirs]:
        dir_to_find_path = base_dir_path.joinpath(dir_to_find[1:] if Path(dir_to_find).is_absolute() else dir_to_find)
        dir_found_includes, dir_found_exceptions = find_files_in_directory(
            dir_to_find_path, extension, sought_exceptions
        )
        found_includes.extend(dir_found_includes)
        found_exceptions.extend(dir_found_exceptions)

    files_to_put_first.reverse()
    for file_to_put_first in files_to_put_first:
        file_to_put_first_path = base_dir_path.joinpath(
            file_to_put_first[1:] if Path(file_to_put_first).is_absolute() else file_to_put_first
        )
        if file_to_put_first_path in found_includes:
            found_includes = [
                file_to_put_first_path,
                *[found_include for found_include in found_includes if found_include != file_to_put_first_path],
            ]
        if file_to_put_first_path in found_exceptions:
            found_exceptions = [
                file_to_put_first_path,
                *[found_exception for found_exception in found_exceptions if found_exception != file_to_put_first_path],
            ]

    # Calculate how many lines to write in each file.
    total_lines = len(found_includes)

    # Adjust number of output files according to whether it's a dev or release build.
    num_output_files = 1

    if includes_per_scu == 0:
        includes_per_scu = _max_includes_per_scu
    else:
        if includes_per_scu > _max_includes_per_scu:
            includes_per_scu = _max_includes_per_scu

    num_output_files = max(math.ceil(total_lines / float(includes_per_scu)), 1)

    lines_per_file = math.ceil(total_lines / float(num_output_files))
    lines_per_file = max(lines_per_file, 1)

    start_line = 0

    # These do not vary throughout the loop
    output_dir_path = abs_main_dir_path.joinpath(".scu")
    output_filename_prefix = "scu_" + out_filename

    # Make includes relative to the .scu directory.
    found_includes = [Path(include).relative_to(output_dir_path, walk_up=True) for include in found_includes]

    fresh_files = set()

    for file_count in range(0, num_output_files):
        end_line = start_line + lines_per_file

        # special case to cover rounding error in final file
        if file_count == (num_output_files - 1):
            end_line = len(found_includes)

        fresh_file = write_output_file(
            file_count,
            found_includes,
            start_line,
            end_line,
            output_dir_path,
            output_filename_prefix,
            extension,
        )

        fresh_files.add(fresh_file)

        start_line = end_line

    # Write the exceptions each in their own scu gen file,
    # so they can effectively compile in "old style / normal build".
    for exception_count in range(len(found_exceptions)):
        fresh_file = write_exception_output_file(
            exception_count,
            found_exceptions[exception_count],
            output_dir_path.as_posix(),
            output_filename_prefix,
            extension,
        )

        fresh_files.add(fresh_file)

    # Clear out any stale file (usually we will be overwriting if necessary,
    # but we want to remove any that are pre-existing that will not be
    # overwritten, so as to not compile anything stale).
    clear_out_stale_files(output_dir_path.as_posix(), extension, fresh_files)


def generate_scu_files(max_includes_per_scu):
    global _max_includes_per_scu
    _max_includes_per_scu = max_includes_per_scu

    print("SCU: Generating build files... (max includes per SCU: %d)" % _max_includes_per_scu)

    cwd = os.getcwd()

    # check we are running from the correct directory.
    if not is_dir("core") or not is_dir("platform") or not is_dir("scene"):
        raise RuntimeError("scu_builders.py must be run from the `godot` repository directory.")

    process_directory("core")
    process_directory("core/crypto")
    process_directory("core/debugger")
    process_directory("core/extension")
    process_directory("core/input")
    process_directory("core/io")
    process_directory("core/math")
    process_directory("core/object")
    process_directory("core/os")
    process_directory("core/string")
    process_directory("core/variant", sought_exceptions=["variant_utility"])

    process_directory("drivers/unix")
    process_directory("drivers/png")

    process_directory("drivers/gles3/effects")
    process_directory("drivers/gles3/storage")

    process_directory("editor", includes_per_scu=32)
    process_directory("editor/animation")
    process_directory("editor/asset_library")
    process_directory("editor/audio")
    process_directory("editor/debugger")
    process_directory("editor/debugger/debug_adapter")
    process_directory("editor/doc")
    process_directory("editor/docks", sought_exceptions=["file_system_dock"])
    process_directory("editor/export")
    process_directory("editor/file_system")
    process_directory("editor/gui")
    process_directory("editor/inspector", sought_exceptions=["editor_resource_preview"])
    process_directory("editor/themes")
    process_directory("editor/project_manager")
    process_directory("editor/project_upgrade")
    process_directory("editor/import")
    process_directory("editor/import/3d")
    process_directory("editor/plugins")
    process_directory("editor/run")
    process_directory("editor/scene")
    process_directory("editor/scene/2d")
    process_directory("editor/scene/2d/physics")
    process_directory("editor/scene/2d/tiles")
    process_directory("editor/scene/3d")
    process_directory("editor/scene/3d/gizmos")
    process_directory("editor/scene/gui")
    process_directory("editor/scene/texture")
    process_directory("editor/script")
    process_directory("editor/settings")
    process_directory("editor/shader")
    process_directory("editor/translations")
    process_directory("editor/version_control")

    process_directory("platform/android/export")
    process_directory("platform/ios/export")
    process_directory("platform/linuxbsd/export")
    process_directory("platform/macos/export")
    process_directory("platform/web/export")
    process_directory("platform/windows/export")

    process_directory("modules/lightmapper_rd")
    process_directory("modules/gltf")
    process_directory("modules/gltf/structures")
    process_directory("modules/gltf/editor")
    process_directory("modules/gltf/extensions")
    process_directory("modules/gltf/extensions/physics")
    process_directory("modules/navigation_3d")
    process_directory("modules/navigation_3d/3d")
    process_directory("modules/navigation_2d")
    process_directory("modules/navigation_2d/2d")
    process_directory("modules/webrtc")
    process_directory("modules/websocket")
    process_directory("modules/gridmap")
    process_directory("modules/multiplayer")
    process_directory("modules/multiplayer/editor")
    process_directory("modules/openxr", sought_exceptions=["register_types"])
    process_directory("modules/openxr/action_map")
    process_directory("modules/openxr/editor")
    # process_directory("modules/openxr/extensions")  # Sensitive include order for platform code.
    process_directory("modules/openxr/scene")
    process_directory("modules/godot_physics_2d")
    process_directory("modules/godot_physics_3d")
    process_directory("modules/godot_physics_3d/joints")

    process_directory("modules/csg")
    process_directory("modules/gdscript")
    process_directory("modules/gdscript/editor")
    process_directory("modules/gdscript/language_server")

    process_directory("scene/2d")
    process_directory("scene/2d/physics")
    process_directory("scene/2d/physics/joints")
    process_directory("scene/3d")
    process_directory("scene/3d/physics")
    process_directory("scene/3d/physics/joints")
    process_directory("scene/3d/xr")
    process_directory("scene/animation")
    process_directory("scene/gui")
    process_directory("scene/main")
    process_directory("scene/theme")
    process_directory("scene/resources")
    process_directory("scene/resources/2d")
    process_directory("scene/resources/2d/skeleton")
    process_directory("scene/resources/3d")

    process_directory("servers")
    process_directory("servers/rendering")
    process_directory("servers/rendering/dummy/storage")
    process_directory("servers/rendering/storage")
    process_directory("servers/rendering/renderer_rd")
    process_directory("servers/rendering/renderer_rd/effects")
    process_directory("servers/rendering/renderer_rd/environment")
    process_directory("servers/rendering/renderer_rd/storage_rd")
    process_directory("servers/rendering/renderer_rd/forward_clustered")
    process_directory("servers/rendering/renderer_rd/forward_mobile")
    process_directory("servers/audio")
    process_directory("servers/audio/effects")
    process_directory("servers/navigation_2d")
    process_directory("servers/navigation_3d")
    process_directory("servers/xr")

    # NOTE: Tests previously compiled as one large unit. We replicate this behavior in SCU builds.
    process_directory(
        [
            "tests",
            "/core",
            "/core/config",
            "/core/input",
            "/core/io",
            "/core/math",
            "/core/object",
            "/core/os",
            "/core/string",
            "/core/templates",
            "/core/threads",
            "/core/variant",
            "/scene",
            "/servers",
            "/servers/rendering",
        ],
        # sought_exceptions=["test_macros", "test_main"],
        files_to_put_first=["tests/test_main.cpp"],
    )

    # Finally change back the path to the calling directory.
    os.chdir(cwd)

    if _verbose:
        print("SCU: Processed directories: %s" % sorted(_scu_directories))

    return _scu_directories
