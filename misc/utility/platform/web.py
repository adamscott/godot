from misc.utility.scons_hints import *  # noqa: F403

import re


def add_emscripten_library(env, lib_name, entry_point, *, additional_source=None):
    """
    The emscripten build of a library is quite an undertaking, so this is
    essentially a wrapper for that process.
    """
    suffix = ".module"
    module_target = f"#bin/obj/platform/web/dist/emscripten/lib{lib_name}{suffix}.js"
    final_target = f"#bin/obj/platform/web/dist/emscripten/lib{lib_name}.js"

    lib_env = env.Clone(
        ESBUILD_TYPE="emscripten",
        ESBUILD_EMSCRIPTEN_NAME=lib_name,
        ESBUILD_EMSCRIPTEN_SOURCE=entry_point,
        ESBUILD_EMSCRIPTEN_OUTPUT_DIR="#bin/obj/platform/web/dist/emscripten/",
        ESBUILD_EMSCRIPTEN_SUFFIX=suffix,
    )

    source = [
        lib_env.Glob("#platform/web/src/typescript/shared/**.ts"),
        lib_env.Glob("#platform/web/src/typescript/emscripten/libraries/**.ts"),
        entry_point,
    ]
    if additional_source is not None:
        if isinstance(additional_source, list):
            source += additional_source
        else:
            source.append(additional_source)

    lib_env.RunEsbuild(target=module_target, source=source)

    def remove_module_export(target, source, env):
        with open(str(target[0]), "w+") as target_file:
            source_file_contents = ""
            with open(str(source[0]), "r") as source_file:
                source_file_contents = source_file.read()

            export_regex = re.compile("\n(export {.+?};\n)$", flags=re.DOTALL)
            target_file_contents = re.sub(export_regex, "", source_file_contents)
            target_file.write(target_file_contents)

    env.Command(action=remove_module_export, target=final_target, source=module_target)
    env.AddJSLibraries(final_target)
