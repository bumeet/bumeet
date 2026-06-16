# PyInstaller spec — produces a single-file executable for the BUMEET agent.
# Build:  pyinstaller bumeet-agent.spec

import sys
from pathlib import Path

block_cipher = None

a = Analysis(
    ['src/bumeet_agent/app.py'],
    pathex=[str(Path('src').resolve())],
    binaries=[],
    datas=[
        # Include the entire package so all submodules are available
        ('src/bumeet_agent', 'bumeet_agent'),
    ],
    hiddenimports=[
        # Platform-specific detection modules loaded at runtime
        'bumeet_agent.detection.macos',
        'bumeet_agent.detection.windows',
        # bleak backends resolved at runtime
        'bleak.backends.corebluetooth',
        'bleak.backends.winrt',
        'bleak.backends.bluezdbus',
        # pydantic v2 internals
        'pydantic.deprecated.class_validators',
        # pystray backends (resolved at runtime per platform)
        'pystray._darwin',
        'pystray._win32',
        # PIL modules used by tray/icon.py
        'PIL.Image',
        'PIL.ImageDraw',
        'PIL.ImageFont',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Never used in the agent — keep the binary small
        'tkinter',
        'matplotlib',
        'numpy',
        'scipy',
        'IPython',
        'jupyter',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    # Name changes per platform in the GitHub Actions workflow via --name flag
    name='bumeet-agent',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,          # no terminal window on Windows/macOS
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    # macOS: embed icon when available
    icon=None,
)
