#!/usr/bin/env python3
"""
Portable Toolchain Bootstrapper for Folio Zero (Update 4.1)
Installs isolated binaries into /opt/folio-toolchains/ (outside /app/applet so
the workspace file sync stays fast and never locks up):
  - cmake      (Portable CMake 3.30.5 + Ninja 1.12.1)
  - msvc-cmake (CMake Windows/MSVC cross-compilation toolchain .cmake)
  - godot      (Godot 4.3-stable Linux x64 CLI + multi-platform export presets/templates metadata)
  - kotlinc    (Kotlin Compiler 2.0.21 + Portable Adoptium Temurin JRE 21)
  - blender    (Blender 3.6.18 LTS Linux x64)
"""

from __future__ import annotations

import json
import lzma
import os
import shutil
import stat
import sys
import tarfile
import urllib.request
import zipfile

TOOLCHAINS_DIR = os.environ.get("FOLIO_TOOLCHAINS_DIR") or "/opt/folio-toolchains"
TMP_DL = "/tmp/folio-toolchains-dl"


def _download(url: str, dest: str) -> None:
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "Folio-Zero-Toolchain/4.1"})
    with urllib.request.urlopen(req, timeout=240) as resp, open(dest, "wb") as out:
        shutil.copyfileobj(resp, out, length=1024 * 256)


def _chmod_x(path: str) -> None:
    if os.path.exists(path):
        st = os.stat(path)
        os.chmod(path, st.st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def setup_msvc_cmake_toolchain() -> dict:
    cmake_dir = os.path.join(TOOLCHAINS_DIR, "cmake")
    os.makedirs(cmake_dir, exist_ok=True)
    tc_path = os.path.join(cmake_dir, "msvc-x64.cmake")
    content = """# Folio Zero CMake Windows / MSVC Cross-Compilation Toolchain
set(CMAKE_SYSTEM_NAME Windows)
set(CMAKE_SYSTEM_PROCESSOR AMD64)
set(CMAKE_C_COMPILER x86_64-w64-mingw32-gcc)
set(CMAKE_CXX_COMPILER x86_64-w64-mingw32-g++)
set(CMAKE_RC_COMPILER x86_64-w64-mingw32-windres)
set(CMAKE_FIND_ROOT_PATH /usr/x86_64-w64-mingw32)
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
add_compile_definitions(_CRT_SECURE_NO_WARNINGS WIN32_LEAN_AND_MEAN NOMINMAX)
"""
    with open(tc_path, "w", encoding="utf-8") as fh:
        fh.write(content)
    return {"ok": True, "toolchainFile": tc_path}


def install_cmake() -> dict:
    cmake_root = os.path.join(TOOLCHAINS_DIR, "cmake-dist")
    cmake_bin = os.path.join(cmake_root, "bin", "cmake")
    ninja_bin = os.path.join(cmake_root, "bin", "ninja")
    os.makedirs(os.path.join(cmake_root, "bin"), exist_ok=True)
    os.makedirs(TMP_DL, exist_ok=True)

    if not os.path.exists(cmake_bin):
        tgz_path = os.path.join(TMP_DL, "cmake.tar.gz")
        url = "https://github.com/Kitware/CMake/releases/download/v3.30.5/cmake-3.30.5-linux-x86_64.tar.gz"
        _download(url, tgz_path)
        extract_tmp = os.path.join(TMP_DL, "cmake_extract")
        shutil.rmtree(extract_tmp, ignore_errors=True)
        os.makedirs(extract_tmp, exist_ok=True)
        with tarfile.open(tgz_path, "r:gz") as tf:
            tf.extractall(extract_tmp)
        sub = [os.path.join(extract_tmp, d) for d in os.listdir(extract_tmp) if os.path.isdir(os.path.join(extract_tmp, d))]
        if sub:
            shutil.rmtree(cmake_root, ignore_errors=True)
            shutil.move(sub[0], cmake_root)
        _chmod_x(cmake_bin)
        shutil.rmtree(extract_tmp, ignore_errors=True)
        try:
            os.remove(tgz_path)
        except OSError:
            pass

    if not os.path.exists(ninja_bin):
        nz_path = os.path.join(TMP_DL, "ninja.zip")
        nz_url = "https://github.com/ninja-build/ninja/releases/download/v1.12.1/ninja-linux.zip"
        _download(nz_url, nz_path)
        os.makedirs(os.path.join(cmake_root, "bin"), exist_ok=True)
        with zipfile.ZipFile(nz_path, "r") as zf:
            for member in zf.namelist():
                if os.path.basename(member) == "ninja":
                    with zf.open(member) as src, open(ninja_bin, "wb") as dst:
                        shutil.copyfileobj(src, dst)
                    break
        _chmod_x(ninja_bin)
        try:
            os.remove(nz_path)
        except OSError:
            pass

    return {
        "ok": os.path.exists(cmake_bin),
        "cmake": cmake_bin,
        "ninja": ninja_bin if os.path.exists(ninja_bin) else shutil.which("ninja"),
    }


def install_godot() -> dict:
    godot_dir = os.path.join(TOOLCHAINS_DIR, "godot")
    godot_bin = os.path.join(godot_dir, "godot4")
    tpl_dir = os.path.join(godot_dir, "export_templates", "4.3.stable")
    os.makedirs(tpl_dir, exist_ok=True)

    if not os.path.exists(godot_bin):
        os.makedirs(TMP_DL, exist_ok=True)
        zip_path = os.path.join(TMP_DL, "godot4.zip")
        url = "https://github.com/godotengine/godot-builds/releases/download/4.3-stable/Godot_v4.3-stable_linux.x86_64.zip"
        _download(url, zip_path)
        with zipfile.ZipFile(zip_path, "r") as zf:
            for member in zf.namelist():
                if member.endswith("Godot_v4.3-stable_linux.x86_64"):
                    with zf.open(member) as src, open(godot_bin, "wb") as dst:
                        shutil.copyfileobj(src, dst)
                    break
        _chmod_x(godot_bin)
        try:
            os.remove(zip_path)
        except OSError:
            pass

    # Standard Godot 4.3 Export Preset definitions for all target platforms
    presets_catalog = {
        "godotVersion": "4.3-stable",
        "cliBinary": godot_bin,
        "templatesDir": tpl_dir,
        "releaseChannels": ["4.3-stable", "4.2.2-stable", "4.1.4-stable", "3.6-stable"],
        "presetsSupported": [
            {"id": "linux", "platform": "Linux/X11", "arch": "x86_64", "exportExt": ".x86_64"},
            {"id": "windows", "platform": "Windows Desktop", "arch": "x86_64", "exportExt": ".exe"},
            {"id": "macos", "platform": "macOS", "arch": "universal", "exportExt": ".dmg"},
            {"id": "web", "platform": "Web", "arch": "wasm32", "exportExt": ".html"},
            {"id": "android", "platform": "Android", "arch": "arm64-v8a", "exportExt": ".apk"},
            {"id": "ios", "platform": "iOS", "arch": "arm64", "exportExt": ".ipa"},
        ],
    }
    with open(os.path.join(godot_dir, "sdk-manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(presets_catalog, fh, indent=2)
    return {"ok": os.path.exists(godot_bin), "binary": godot_bin, "manifest": presets_catalog}


def install_kotlin() -> dict:
    kotlin_dir = os.path.join(TOOLCHAINS_DIR, "kotlinc")
    kotlin_bin = os.path.join(kotlin_dir, "bin", "kotlinc")
    java_dir = os.path.join(TOOLCHAINS_DIR, "java")
    java_bin = os.path.join(java_dir, "bin", "java")

    os.makedirs(TMP_DL, exist_ok=True)

    if not os.path.exists(java_bin) and not shutil.which("java"):
        jre_tgz = os.path.join(TMP_DL, "temurin21-jre.tar.gz")
        jre_url = "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jre/hotspot/normal/eclipse"
        _download(jre_url, jre_tgz)
        extract_tmp = os.path.join(TMP_DL, "jre_extract")
        shutil.rmtree(extract_tmp, ignore_errors=True)
        os.makedirs(extract_tmp, exist_ok=True)
        with tarfile.open(jre_tgz, "r:gz") as tf:
            tf.extractall(extract_tmp)
        sub = [os.path.join(extract_tmp, d) for d in os.listdir(extract_tmp) if os.path.isdir(os.path.join(extract_tmp, d))]
        if sub:
            shutil.rmtree(java_dir, ignore_errors=True)
            shutil.move(sub[0], java_dir)
        shutil.rmtree(extract_tmp, ignore_errors=True)
        try:
            os.remove(jre_tgz)
        except OSError:
            pass

    if not os.path.exists(kotlin_bin):
        kc_zip = os.path.join(TMP_DL, "kotlinc.zip")
        kc_url = "https://github.com/JetBrains/kotlin/releases/download/v2.0.21/kotlin-compiler-2.0.21.zip"
        _download(kc_url, kc_zip)
        extract_tmp = os.path.join(TMP_DL, "kc_extract")
        shutil.rmtree(extract_tmp, ignore_errors=True)
        os.makedirs(extract_tmp, exist_ok=True)
        with zipfile.ZipFile(kc_zip, "r") as zf:
            zf.extractall(extract_tmp)
        cand = os.path.join(extract_tmp, "kotlinc")
        if os.path.isdir(cand):
            shutil.rmtree(kotlin_dir, ignore_errors=True)
            shutil.move(cand, kotlin_dir)
        for exe in ("kotlinc", "kotlin", "kotlinc-jvm", "kotlinc-js"):
            _chmod_x(os.path.join(kotlin_dir, "bin", exe))
        shutil.rmtree(extract_tmp, ignore_errors=True)
        try:
            os.remove(kc_zip)
        except OSError:
            pass

    return {
        "ok": os.path.exists(kotlin_bin),
        "kotlinc": kotlin_bin,
        "java": java_bin if os.path.exists(java_bin) else shutil.which("java"),
    }


def install_blender() -> dict:
    blender_dir = os.path.join(TOOLCHAINS_DIR, "blender")
    blender_bin = os.path.join(blender_dir, "blender")
    if os.path.exists(blender_bin):
        return {"ok": True, "alreadyInstalled": True, "binary": blender_bin}

    os.makedirs(TMP_DL, exist_ok=True)
    tar_xz = os.path.join(TMP_DL, "blender.tar.xz")
    url = "https://download.blender.org/release/Blender3.6/blender-3.6.18-linux-x64.tar.xz"
    _download(url, tar_xz)
    extract_tmp = os.path.join(TMP_DL, "blender_extract")
    shutil.rmtree(extract_tmp, ignore_errors=True)
    os.makedirs(extract_tmp, exist_ok=True)
    with lzma.open(tar_xz) as xz_stream:
        with tarfile.open(fileobj=xz_stream, mode="r|*") as tf:
            tf.extractall(extract_tmp)
    sub = [os.path.join(extract_tmp, d) for d in os.listdir(extract_tmp) if os.path.isdir(os.path.join(extract_tmp, d))]
    if sub:
        shutil.rmtree(blender_dir, ignore_errors=True)
        shutil.move(sub[0], blender_dir)
    _chmod_x(blender_bin)
    shutil.rmtree(extract_tmp, ignore_errors=True)
    try:
        os.remove(tar_xz)
    except OSError:
        pass

    return {"ok": os.path.exists(blender_bin), "binary": blender_bin}


def main() -> int:
    targets = set(sys.argv[1:]) or {"cmake", "msvc-cmake", "godot", "kotlinc", "blender"}
    results = {}
    if "msvc-cmake" in targets:
        results["msvc-cmake"] = setup_msvc_cmake_toolchain()
    if "cmake" in targets:
        results["cmake"] = install_cmake()
    if "godot" in targets:
        results["godot"] = install_godot()
    if "kotlinc" in targets:
        results["kotlinc"] = install_kotlin()
    if "blender" in targets:
        results["blender"] = install_blender()
    print(json.dumps(results, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
