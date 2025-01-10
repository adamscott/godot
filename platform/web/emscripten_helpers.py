import json
import os
from functools import partial

from SCons.Script import Copy, Delete
from SCons.Util import WhereIs

from platform_methods import get_build_version


def run_closure_compiler(target, source, env, for_signature):
    closure_bin = os.path.join(
        os.path.dirname(WhereIs("emcc")),
        "node_modules",
        ".bin",
        "google-closure-compiler",
    )
    cmd = [WhereIs("node"), closure_bin]
    cmd.extend(["--compilation_level", "ADVANCED_OPTIMIZATIONS"])
    for f in env["JSEXTERNS"]:
        cmd.extend(["--externs", f.get_abspath()])
    for f in source:
        cmd.extend(["--js", f.get_abspath()])
    cmd.extend(["--js_output_file", target[0].get_abspath()])
    return " ".join(cmd)


def create_engine_file(env, target, source, externs, threads_enabled):
    if env["use_closure_compiler"]:
        return env.BuildJS(target, source, JSEXTERNS=externs)
    subst_dict = {"___GODOT_THREADS_ENABLED": "true" if threads_enabled else "false"}
    return env.Substfile(target=target, source=[env.File(s) for s in source], SUBST_DICT=subst_dict)


def create_template_zip(env, js, wasm, side):
    binary_name = "godot.editor" if env.editor_build else "godot"
    zip_dir = env.Dir(env.GetTemplateZipPath())
    in_files = [
        js,
        wasm,
        "#platform/web/js/libs/audio.worklet.js",
        "#platform/web/js/libs/audio.position.worklet.js",
    ]
    out_files = [
        zip_dir.File(binary_name + ".js"),
        zip_dir.File(binary_name + ".wasm"),
        zip_dir.File(binary_name + ".audio.worklet.js"),
        zip_dir.File(binary_name + ".audio.position.worklet.js"),
    ]
    # Dynamic linking (extensions) specific.
    if env["dlink_enabled"]:
        in_files.append(side)  # Side wasm (contains the actual Godot code).
        out_files.append(zip_dir.File(binary_name + ".side.wasm"))

    service_worker = "#misc/dist/html/service-worker.js"
    if env.editor_build:
        # HTML
        html_template = env.File("#misc/dist/html/editor.html")
        cache = [
            "godot.editor.html",
            "offline.html",
            "godot.editor.js",
            "godot.editor.audio.worklet.js",
            "godot.editor.audio.position.worklet.js",
            "logo.svg",
            "favicon.png",
        ]
        opt_cache = ["godot.editor.wasm"]
        subst_dict = {
            "___GODOT_VERSION___": get_build_version(False),
            "___GODOT_NAME___": "GodotEngine",
            "___GODOT_CACHE___": json.dumps(cache),
            "___GODOT_OPT_CACHE___": json.dumps(opt_cache),
            "___GODOT_OFFLINE_PAGE___": "offline.html",
            "___GODOT_THREADS_ENABLED___": "true" if env["threads"] else "false",
            "___GODOT_ENSURE_CROSSORIGIN_ISOLATION_HEADERS___": "true",
        }
        html_target = env.File("#bin/godot${PROGSUFFIX}.html")
        env.Execute(env.Substfile(target=html_target, source=html_template, SUBST_DICT=subst_dict))
        in_files.append(html_target)
        out_files.append(zip_dir.File(binary_name + ".html"))
        # And logo/favicon
        in_files.append("#misc/dist/html/logo.svg")
        out_files.append(zip_dir.File("logo.svg"))
        in_files.append("#icon.png")
        out_files.append(zip_dir.File("favicon.png"))
        # PWA
        service_worker = env.Substfile(
            target="#bin/godot${PROGSUFFIX}.service.worker.js",
            source=service_worker,
            SUBST_DICT=subst_dict,
        )
        in_files.append(service_worker)
        out_files.append(zip_dir.File("service.worker.js"))
        in_files.append("#misc/dist/html/manifest.json")
        out_files.append(zip_dir.File("manifest.json"))
        in_files.append("#misc/dist/html/offline.html")
        out_files.append(zip_dir.File("offline.html"))
    else:
        # HTML
        in_files.append("#misc/dist/html/full-size.html")
        out_files.append(zip_dir.File(binary_name + ".html"))
        in_files.append(service_worker)
        out_files.append(zip_dir.File(binary_name + ".service.worker.js"))
        in_files.append("#misc/dist/html/offline-export.html")
        out_files.append(zip_dir.File("godot.offline.html"))

    zip_files = env.InstallAs(out_files, in_files)
    zip_files_command = env.Zip(
        "#bin/godot",
        zip_files,
        ZIPROOT=zip_dir,
        ZIPSUFFIX="${PROGSUFFIX}${ZIPSUFFIX}",
    )

    if env.editor_build:
        # Make sure to get built files size before zipping them.
        append_file_sizes_action = partial(append_file_sizes, file_to_inject=html_target)
        append_file_sizes_action.__name__ = "append_file_sizes"
        append_file_sizes_command = env.Command(
            "append_file_sizes",
            action=append_file_sizes_action,
            source=zip_files,
        )
        env.Depends(zip_files_command, append_file_sizes_command)
        env.Depends(append_file_sizes_command, html_target)
        env.Depends(append_file_sizes_command, zip_files)


def get_template_zip_path(env):
    return "#bin/.web_zip"


def add_js_libraries(env, libraries):
    env.Append(JS_LIBS=env.File(libraries))


def add_js_pre(env, js_pre):
    env.Append(JS_PRE=env.File(js_pre))


def add_js_externs(env, externs):
    env.Append(JS_EXTERNS=env.File(externs))


def append_file_sizes(target, source, env, file_to_inject):
    file_sizes = {}
    root_dir_name = env.Dir("#").abspath

    for _source in source:
        path = os.path.join(root_dir_name, _source.path)
        stat_result = os.stat(path)
        file_sizes[os.path.basename(_source.path)] = stat_result.st_size

    subst_dict = {"___GODOT_FILE_SIZES___": json.dumps(file_sizes)}
    tmp_file = env.File(f"{file_to_inject}.tmp")
    subst_file = env.Substfile(
        target=tmp_file,
        source=file_to_inject,
        SUBST_DICT=subst_dict,
    )
    copy_back = env.Command("Copy back .html", action=Copy(file_to_inject, tmp_file), source=subst_file)
    env.Command("Delete tmp", action=Delete(tmp_file), source=copy_back)
