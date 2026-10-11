"""Repair USDZ container alignment without changing embedded USD/texture bytes.
Usage: python scripts/prepare-ar-packages.py input.usdz output.usdz
Original uploads and source hashes are recorded in docs/uploaded-ar-inventory.json.
"""
import hashlib
import pathlib
import shutil
import struct
import sys
import zipfile

source, target = map(pathlib.Path, sys.argv[1:3])
if source.resolve() == target.resolve():
    raise SystemExit('Use a separate output path; preserve the source upload.')

def aligned(path):
    with zipfile.ZipFile(path) as package, path.open('rb') as binary:
        for entry in package.infolist():
            binary.seek(entry.header_offset + 26)
            name_length, extra_length = struct.unpack('<HH', binary.read(4))
            offset = entry.header_offset + 30 + name_length + extra_length
            if offset % 64 or entry.compress_type != zipfile.ZIP_STORED:
                return False
    return True

target.parent.mkdir(parents=True, exist_ok=True)
if aligned(source):
    shutil.copyfile(source, target)
else:
    with zipfile.ZipFile(source) as old, zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_STORED) as new:
        for original in old.infolist():
            entry = zipfile.ZipInfo(original.filename, date_time=original.date_time)
            entry.external_attr = original.external_attr
            padding = (-(new.fp.tell() + 30 + len(entry.filename.encode('utf-8')))) % 64
            if padding:
                if padding < 4:
                    padding += 64
                entry.extra = struct.pack('<HH', 0x1986, padding - 4) + bytes(padding - 4)
            new.writestr(entry, old.read(original.filename))
assert aligned(target)
with zipfile.ZipFile(source) as old, zipfile.ZipFile(target) as new:
    assert old.namelist() == new.namelist() and new.testzip() is None
    assert all(old.read(name) == new.read(name) for name in old.namelist())
print('Aligned USDZ, embedded payloads unchanged:', hashlib.sha256(target.read_bytes()).hexdigest())
