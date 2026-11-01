# Restaurant dashboard before Studio

This non-served archive preserves the authenticated dashboard as it existed at
commit `ecaf036a1c69964ca9a5a71bd32c2be3e7786445`, before integrating the approved
Vistaire Studio dashboard (demo source `c9063216ab7a868524319ec7e0115cbdadaba068`).

`source/` contains inert, byte-identical `.txt` copies of the prior `app/(fr)/admin`, `components/admin`, and
`lib/admin` sources. It contains source code only, no user data or credentials.
It is outside `app/` and `public/` and cannot be requested as a legacy dashboard.
There is no `/admin/legacy` route. The four protected admin routes render Studio.

`manifest.json` records the original paths and SHA-256 of all 81 files. The
`.txt` suffix prevents these archived modules from being compiled or imported.

To inspect or recover, copy into a separate temporary directory and remove only
the final `.txt` suffix from each path. For example, run from this directory:

    python3 - <<'PYTHON'
    import hashlib, json, pathlib
    archive = pathlib.Path.cwd()
    output = pathlib.Path('/tmp/vistaire-admin-before-studio')
    for item in json.loads((archive / 'manifest.json').read_text())['files']:
        data = (archive / item['snapshot']).read_bytes()
        assert hashlib.sha256(data).hexdigest() == item['sha256']
        target = output / item['path']
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    PYTHON

Do not overwrite current authorization, APIs, or data services during a UI
rollback. Restore the required presentation in a reviewed branch, preserving
subsequent security and data fixes. Shared presentation/chart primitives remain
in their original source locations where used by existing public previews;
none is a separately served dashboard.

Three legacy visual E2E files are also preserved as inert text. Their old pixel composition, animation markers and removed controls are historical contracts, not active Studio tests. Current equivalent coverage is mapped in `../../admin-studio-test-mapping.md`.

The previous public restaurateur demo and its stylesheet are preserved as well, so the public preview can be inspected alongside the authenticated predecessor.
