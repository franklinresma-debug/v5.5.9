#!/usr/bin/env python3

import os
import shutil
import sys
from pathlib import Path

HOME_ROOT = Path("/home/frankresma").resolve()
CURRENT_DIR = Path(sys.argv[1]).resolve()
CURRENT_NAME = CURRENT_DIR.name
CURRENT_ZIP = HOME_ROOT / f"{CURRENT_NAME}.zip"
MODE = sys.argv[2] if len(sys.argv) > 2 else "final"

PREFIXES = (
    "NurseLink_Mobile_Responsive_Installer_v",
    "NurseLink_Global_Mobile_Responsive_Installer_v",
)

PROTECTED = {
    (HOME_ROOT / "nurselink-api").resolve(),
    (HOME_ROOT / "nurselink-web").resolve(),
    (HOME_ROOT / "app.amsertech.com").resolve(),
    (HOME_ROOT / "nurselink-backups").resolve(),
    (HOME_ROOT / "public_html").resolve(),
    (HOME_ROOT / "public_ftp").resolve(),
    (HOME_ROOT / "ssl").resolve(),
    (HOME_ROOT / "tmp").resolve(),
}

def is_installer_name(name):
    return any(name.startswith(prefix) for prefix in PREFIXES)

def assert_safe_target(path):
    resolved = path.resolve(strict=False)

    if resolved == CURRENT_DIR:
        raise RuntimeError(
            f"Refusing to delete current installer directory: {path}"
        )

    if resolved in PROTECTED:
        raise RuntimeError(
            f"Refusing to delete protected NurseLink/hosting path: {path}"
        )

    if resolved.parent != HOME_ROOT:
        raise RuntimeError(
            f"Refusing cleanup outside /home/frankresma: {path}"
        )

    if not is_installer_name(path.name):
        raise RuntimeError(
            f"Refusing cleanup of non-installer path: {path}"
        )

def candidates():
    folders = []
    zips = []

    for entry in HOME_ROOT.iterdir():
        name = entry.name

        if not is_installer_name(name):
            continue

        if entry.is_dir():
            if entry.resolve() != CURRENT_DIR:
                folders.append(entry)
            continue

        if entry.is_file() and name.endswith(".zip"):
            if entry.resolve() != CURRENT_ZIP.resolve(strict=False):
                zips.append(entry)

    return sorted(folders), sorted(zips)

if not CURRENT_DIR.is_dir():
    raise SystemExit(
        f"Current installer directory does not exist: {CURRENT_DIR}"
    )

if CURRENT_DIR.parent != HOME_ROOT:
    raise SystemExit(
        "Current installer must be extracted directly under /home/frankresma."
    )

removed_folders = 0
removed_zips = 0

folders, zips = candidates()

print(
    f"{MODE.capitalize()} installer cleanup scan: "
    f"{len(folders)} old folder(s), {len(zips)} old ZIP(s)."
)

for folder in folders:
    assert_safe_target(folder)
    shutil.rmtree(folder)
    if folder.exists():
        raise RuntimeError(
            f"Old installer folder still exists after deletion: {folder}"
        )
    removed_folders += 1
    print(f"Removed old installer folder: {folder}")

for archive in zips:
    assert_safe_target(archive)
    archive.unlink()
    if archive.exists():
        raise RuntimeError(
            f"Old installer ZIP still exists after deletion: {archive}"
        )
    removed_zips += 1
    print(f"Removed old installer ZIP: {archive}")

# Flush filesystem metadata before verification.
try:
    os.sync()
except AttributeError:
    pass

remaining_folders, remaining_zips = candidates()

if remaining_folders:
    raise RuntimeError(
        "Installer cleanup incomplete. Old folders remain: "
        + ", ".join(str(path) for path in remaining_folders)
    )

if remaining_zips:
    raise RuntimeError(
        "Installer cleanup incomplete. Old ZIPs remain: "
        + ", ".join(str(path) for path in remaining_zips)
    )

if not CURRENT_DIR.is_dir():
    raise RuntimeError(
        "Cleanup safety failure: current installer folder was removed."
    )

print(f"Installer cleanup removed folders: {removed_folders}")
print(f"Installer cleanup removed ZIPs: {removed_zips}")
print(f"Retained current installer folder: {CURRENT_DIR}")

if CURRENT_ZIP.is_file():
    print(f"Retained current installer ZIP: {CURRENT_ZIP}")
else:
    print(f"Current installer ZIP was not present: {CURRENT_ZIP}")

print(f"{MODE.capitalize()} installer cleanup verification [OK]")
