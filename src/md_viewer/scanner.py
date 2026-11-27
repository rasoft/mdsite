import fnmatch
import html
import re
from pathlib import Path


def parse_gitignore(root):
    """Parse .gitignore files from root and return a matcher function."""
    patterns = []
    gitignore = root / ".gitignore"
    if gitignore.is_file():
        for line in gitignore.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            patterns.append(line)

    # Always exclude common non-content directories
    defaults = [".*", "node_modules", "__pycache__", "venv", "dist"]
    for d in defaults:
        if d not in patterns:
            patterns.append(d)

    return patterns


def is_ignored(rel_path, patterns):
    """Check if a relative path matches any gitignore pattern."""
    rel_str = str(rel_path)
    parts = rel_path.parts

    for pattern in patterns:
        negated = pattern.startswith("!")
        if negated:
            continue  # skip negation for simplicity — don't un-ignore

        pat = pattern.rstrip("/")

        # Check each path component against the pattern
        for part in parts:
            if fnmatch.fnmatch(part, pat):
                return True

        # Check full relative path
        if fnmatch.fnmatch(rel_str, pat):
            return True
        if fnmatch.fnmatch(rel_str, pat + "/**"):
            return True
        if fnmatch.fnmatch(rel_str, "**/" + pat):
            return True

    return False


def _is_dir_ignored(name, patterns):
    """Check if a directory name matches any ignore pattern."""
    for pattern in patterns:
        if pattern.startswith("!"):
            continue
        pat = pattern.rstrip("/")
        if fnmatch.fnmatch(name, pat):
            return True
    return False


def _read_gitignore(directory):
    """Read .gitignore patterns from a directory, if present."""
    gitignore = directory / ".gitignore"
    if not gitignore.is_file():
        return []
    patterns = []
    for line in gitignore.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        patterns.append(line)
    return patterns


def scan_md_files(root):
    """Recursively find all .md files, skipping ignored directories."""
    root_patterns = parse_gitignore(root)
    files = []
    # Track resolved directory paths to avoid symlink cycles
    try:
        seen = {root.resolve()}
    except OSError:
        seen = set()
    # Each entry: (directory, accumulated_patterns)
    dirs = [(root, root_patterns)]
    while dirs:
        d, parent_patterns = dirs.pop()
        try:
            entries = sorted(d.iterdir())
        except OSError:
            continue
        # Merge parent patterns with local .gitignore
        local = _read_gitignore(d) if d != root else []
        patterns = parent_patterns + local if local else parent_patterns
        for entry in entries:
            if entry.is_dir():
                if _is_dir_ignored(entry.name, patterns):
                    continue
                try:
                    resolved = entry.resolve()
                except OSError:
                    continue
                if resolved in seen:
                    continue
                seen.add(resolved)
                dirs.append((entry, patterns))
            elif entry.suffix.lower() == ".md" and entry.is_file():
                rel = entry.relative_to(root)
                if is_ignored(rel, patterns):
                    continue
                # Read only first 20 lines for title extraction
                title = rel.stem.replace("-", " ").replace("_", " ").title()
                try:
                    with entry.open(encoding="utf-8", errors="replace") as fh:
                        line_count = 0
                        for i, line in enumerate(fh):
                            if i < 20 and line.startswith("# "):
                                title = line[2:].strip()
                            line_count += 1
                except OSError:
                    line_count = 0
                files.append({
                    "path": rel.as_posix(),
                    "folder": rel.parent.as_posix() if str(rel.parent) != "." else "",
                    "name": rel.name,
                    "title": title,
                    "lines": line_count,
                })
    files.sort(key=lambda f: f["path"])
    return files


_ATX_H1 = re.compile(r"^ {0,3}#(?!#)\s+(.*)$")
_FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})")


def _plain_heading(text):
    """Turn a Markdown heading into plain text for the header label."""
    text = re.sub(r"\s*\{#[^}]+\}\s*$", "", text)
    text = re.sub(r"<!--.*?-->", "", text)
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"(\*\*|__)(.+?)\1", r"\2", text)
    text = re.sub(r"(?<!\w)(\*|_)(.+?)\1(?!\w)", r"\2", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _atx_h1_text(line):
    match = _ATX_H1.match(line.rstrip("\r\n"))
    if not match:
        return None
    return re.sub(r"[ \t]+#+\s*$", "", match.group(1)).strip() or None


def first_h1(path):
    """Return the first level-1 heading in a Markdown file, or None."""
    try:
        fh = path.open(encoding="utf-8-sig", errors="replace")
    except OSError:
        return None

    in_frontmatter = False
    started = False
    in_fence = False
    fence_char = ""
    fence_len = 0
    in_comment = False
    prev = None

    with fh:
        for line in fh:
            raw = line.rstrip("\r\n")

            if not started:
                if not raw.strip():
                    continue
                started = True
                if raw.strip() == "---":
                    in_frontmatter = True
                    continue
            if in_frontmatter:
                if raw.strip() == "---":
                    in_frontmatter = False
                continue

            if in_comment:
                if "-->" in raw:
                    in_comment = False
                prev = None
                continue
            if "<!--" in raw and "-->" not in raw.split("<!--", 1)[1]:
                in_comment = True
                prev = None
                continue

            fence = _FENCE.match(raw)
            if fence:
                marker = fence.group(1)
                char = marker[0]
                run = len(marker)
                rest = raw[fence.end():]
                if not in_fence and not (char == "`" and "`" in rest):
                    in_fence = True
                    fence_char = char
                    fence_len = run
                    prev = None
                    continue
                if in_fence and char == fence_char and run >= fence_len and rest.strip() == "":
                    in_fence = False
                    prev = None
                    continue
            if in_fence:
                prev = None
                continue

            heading = _atx_h1_text(raw)
            if heading is not None:
                plain = _plain_heading(heading)
                if plain:
                    return plain
                prev = None
                continue

            if (
                prev
                and len(raw) - len(raw.lstrip(" ")) <= 3
                and raw.strip()
                and set(raw.strip()) == {"="}
            ):
                plain = _plain_heading(prev)
                if plain:
                    return plain

            if not raw.strip():
                prev = None
            elif len(raw) - len(raw.lstrip(" ")) < 4 and not raw.lstrip().startswith(">"):
                prev = raw.strip()
            else:
                prev = None
    return None


def _find_root_index(root):
    """Top-level index.md, preferring the exact lowercase name."""
    exact = root / "index.md"
    if exact.is_file():
        return exact
    try:
        matches = [
            entry for entry in root.iterdir()
            if entry.is_file() and entry.name.lower() == "index.md"
        ]
    except OSError:
        return None
    matches.sort(key=lambda entry: entry.name)
    return matches[0] if matches else None


def _folder_label(root):
    """Last two directory names of a folder path."""
    parts = [part for part in Path(root).parts if part not in ("/", "\\")]
    if len(parts) >= 2:
        return parts[-2] + "/" + parts[-1]
    if parts:
        return parts[-1]
    return "Markdown Viewer"


def site_title(root):
    """Header label: first H1 of top-level index.md, else the last two directories."""
    index = _find_root_index(Path(root))
    if index is not None:
        heading = first_h1(index)
        if heading:
            return heading
    return _folder_label(root)
