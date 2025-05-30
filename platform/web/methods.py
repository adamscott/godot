from misc.utility.scons_hints import *


def add_emscripten_library(env, lib_name, entry_point, *, additional_sources=None):
    """
    The emscripten build of a library is quite an undertaking, so this is
    essentially a wrapper to that process.
    """
    lib_env = env.Clone(
        ESBUILD_TYPE="emscripten",
        ESBUILD_EMSCRIPTEN_NAME=f"lib{lib_name}",
        ESBUILD_EMSCRIPTEN_SOURCE=entry_point,
        ESBUILD_EMSCRIPTEN_OUTPUT_DIR="#platform/web/dist/emscripten/",
    )

    source = [
        lib_env.Glob("#platform/web/src/typescript/shared/**.ts"),
        lib_env.Glob("#platform/web/src/typescript/browser/emscripten/**.ts"),
        entry_point,
    ]
    if additional_sources is not None:
        if isinstance(additional_sources, list):
            source += additional_sources
        else:
            source.append(additional_sources)

    lib_lib = lib_env.RunEsbuild(target=[entry_point], source=source)
    env.AddJSLibraries([lib_lib])
