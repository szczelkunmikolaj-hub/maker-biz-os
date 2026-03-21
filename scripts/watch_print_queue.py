#!/usr/bin/env python3
"""
3D Print Queue Folder Watcher
Watches /Users/mikolajszczelkun/3DPrintQueue for .gcode and .3mf files.
Groups files by first word of filename into projects.
Exports a JSON file for import into PrintTrack.

Usage:
  python3 scripts/watch_print_queue.py

Dependencies:
  pip3 install watchdog

The script:
  1. Scans the folder on startup for existing files
  2. Watches for new files continuously
  3. Parses .gcode files for print time & filament usage
  4. Groups files by first word of filename into projects
  5. Exports print_queue.json to the watch folder
"""

import os
import re
import json
import time
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    HAS_WATCHDOG = True
except ImportError:
    HAS_WATCHDOG = False
    print("⚠️  watchdog not installed. Install with: pip3 install watchdog")
    print("   Running in single-scan mode (no continuous watching).\n")

WATCH_DIR = os.path.expanduser("~/3DPrintQueue")
OUTPUT_FILE = os.path.join(WATCH_DIR, "print_queue.json")
LOG_FILE = os.path.join(WATCH_DIR, "detection_log.txt")
SUPPORTED_EXTENSIONS = {".gcode", ".3mf"}


def log_detection(message: str):
    """Log a detection event to both console and log file."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    entry = f"[{timestamp}] {message}"
    print(entry)
    with open(LOG_FILE, "a") as f:
        f.write(entry + "\n")


def parse_gcode(filepath: str) -> dict:
    """Parse a .gcode file for estimated print time and filament usage."""
    print_time_hours = 0.0
    filament_grams = 0.0
    filament_type = ""
    filament_color = ""

    try:
        with open(filepath, "r", errors="ignore") as f:
            # Only read first 500 lines for metadata (comments at top)
            for i, line in enumerate(f):
                if i > 500:
                    break
                line = line.strip()

                # PrusaSlicer / SuperSlicer / OrcaSlicer patterns
                if "; estimated printing time" in line.lower():
                    # Format: ; estimated printing time (normal mode) = 2h 30m 15s
                    match = re.search(r"(\d+)h\s*(\d+)m", line)
                    if match:
                        print_time_hours = int(match.group(1)) + int(match.group(2)) / 60
                    else:
                        match = re.search(r"(\d+)m\s*(\d+)s", line)
                        if match:
                            print_time_hours = int(match.group(1)) / 60

                # Cura time estimate
                if ";TIME:" in line:
                    match = re.search(r";TIME:(\d+)", line)
                    if match:
                        print_time_hours = int(match.group(1)) / 3600

                # Filament used in mm (PrusaSlicer)
                if "; filament used [mm]" in line.lower() or ";filament used [mm]" in line.lower():
                    match = re.search(r"=\s*([\d.]+)", line)
                    if match:
                        mm_used = float(match.group(1))
                        # Approximate: 1.75mm PLA ~1.24 g/cm³, area = pi*0.0875² cm²
                        volume_cm3 = mm_used * 0.1 * 3.14159 * (0.0875 ** 2)
                        filament_grams = volume_cm3 * 1.24

                # Filament used in grams (direct)
                if "; filament used [g]" in line.lower() or ";filament used [g]" in line.lower():
                    match = re.search(r"=\s*([\d.]+)", line)
                    if match:
                        filament_grams = float(match.group(1))

                # Cura filament weight
                if ";Filament weight" in line:
                    match = re.search(r"=\s*([\d.]+)", line)
                    if match:
                        filament_grams = float(match.group(1))

                # Filament type
                if "; filament_type" in line.lower():
                    match = re.search(r"=\s*(.+)", line)
                    if match:
                        filament_type = match.group(1).strip()

                # Filament color
                if "; filament_colour" in line.lower() or "; filament_color" in line.lower():
                    match = re.search(r"=\s*(.+)", line)
                    if match:
                        filament_color = match.group(1).strip()

    except Exception as e:
        log_detection(f"  ⚠️  Error parsing {filepath}: {e}")

    return {
        "print_time_hours": round(print_time_hours, 2),
        "filament_grams": round(filament_grams, 1),
        "filament_type": filament_type or "PLA",
        "filament_color": filament_color,
    }


def parse_3mf(filepath: str) -> dict:
    """Parse a .3mf file for metadata. 3MF is a ZIP containing XML."""
    print_time_hours = 0.0
    filament_grams = 0.0
    filament_type = ""
    filament_color = ""

    try:
        with zipfile.ZipFile(filepath, "r") as z:
            # Check for PrusaSlicer/OrcaSlicer config
            for name in z.namelist():
                if "config" in name.lower() or "metadata" in name.lower():
                    try:
                        content = z.read(name).decode("utf-8", errors="ignore")

                        # Look for print time
                        match = re.search(r"estimated[_ ]printing[_ ]time.*?(\d+)h\s*(\d+)m", content, re.IGNORECASE)
                        if match:
                            print_time_hours = int(match.group(1)) + int(match.group(2)) / 60

                        # Look for filament weight
                        match = re.search(r"filament[_ ]used\s*\[g\]\s*=\s*([\d.]+)", content, re.IGNORECASE)
                        if match:
                            filament_grams = float(match.group(1))

                        # Filament type
                        match = re.search(r"filament[_ ]type\s*=\s*(.+)", content, re.IGNORECASE)
                        if match:
                            filament_type = match.group(1).strip()

                        # Filament color
                        match = re.search(r"filament[_ ]colou?r\s*=\s*(.+)", content, re.IGNORECASE)
                        if match:
                            filament_color = match.group(1).strip()
                    except:
                        pass
    except Exception as e:
        log_detection(f"  ⚠️  Error parsing 3MF {filepath}: {e}")

    return {
        "print_time_hours": round(print_time_hours, 2),
        "filament_grams": round(filament_grams, 1),
        "filament_type": filament_type or "PLA",
        "filament_color": filament_color,
    }


def get_project_name(filename: str) -> str:
    """Extract project name as the first word of the filename."""
    stem = Path(filename).stem
    # First word (split by space, underscore, or dash)
    first_word = re.split(r"[\s_\-]+", stem)[0]
    return first_word if first_word else stem


def scan_folder(watch_dir: str) -> dict:
    """Scan folder and build project data grouped by first word."""
    projects = {}
    files_log = []

    if not os.path.exists(watch_dir):
        os.makedirs(watch_dir, exist_ok=True)
        log_detection(f"📁 Created watch folder: {watch_dir}")
        return {"projects": [], "files": [], "scanned_at": datetime.now().isoformat()}

    for filename in os.listdir(watch_dir):
        ext = os.path.splitext(filename)[1].lower()
        if ext not in SUPPORTED_EXTENSIONS:
            continue

        filepath = os.path.join(watch_dir, filename)
        if not os.path.isfile(filepath):
            continue

        # Parse file
        if ext == ".gcode":
            data = parse_gcode(filepath)
        else:
            data = parse_3mf(filepath)

        project_name = get_project_name(filename)
        mod_time = datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat()

        file_entry = {
            "filename": filename,
            "project_name": project_name,
            "detected_at": mod_time,
            **data,
        }
        files_log.append(file_entry)

        # Group into project
        if project_name not in projects:
            projects[project_name] = {
                "name": project_name,
                "files": [],
                "total_print_time_hours": 0,
                "total_filament_grams": 0,
                "printed": False,
                "paid": False,
                "shipped": False,
            }

        projects[project_name]["files"].append(file_entry)
        projects[project_name]["total_print_time_hours"] += data["print_time_hours"]
        projects[project_name]["total_filament_grams"] += data["filament_grams"]

        log_detection(f"📄 Detected: {filename} → Project '{project_name}' "
                      f"({data['print_time_hours']}h, {data['filament_grams']}g, {data['filament_type']})")

    # Round totals
    for p in projects.values():
        p["total_print_time_hours"] = round(p["total_print_time_hours"], 2)
        p["total_filament_grams"] = round(p["total_filament_grams"], 1)

    result = {
        "projects": list(projects.values()),
        "files": files_log,
        "scanned_at": datetime.now().isoformat(),
    }

    # Write output
    with open(OUTPUT_FILE, "w") as f:
        json.dump(result, f, indent=2)
    log_detection(f"✅ Exported {len(projects)} projects, {len(files_log)} files → {OUTPUT_FILE}")

    return result


class PrintQueueHandler(FileSystemEventHandler):
    """Watchdog handler that re-scans on file changes."""

    def on_created(self, event):
        if event.is_directory:
            return
        ext = os.path.splitext(event.src_path)[1].lower()
        if ext in SUPPORTED_EXTENSIONS:
            log_detection(f"🆕 New file detected: {os.path.basename(event.src_path)}")
            time.sleep(1)  # Wait for file to finish writing
            scan_folder(WATCH_DIR)

    def on_modified(self, event):
        if event.is_directory:
            return
        ext = os.path.splitext(event.src_path)[1].lower()
        if ext in SUPPORTED_EXTENSIONS:
            log_detection(f"🔄 File modified: {os.path.basename(event.src_path)}")
            time.sleep(1)
            scan_folder(WATCH_DIR)

    def on_deleted(self, event):
        if event.is_directory:
            return
        ext = os.path.splitext(event.src_path)[1].lower()
        if ext in SUPPORTED_EXTENSIONS:
            log_detection(f"🗑️  File removed: {os.path.basename(event.src_path)}")
            scan_folder(WATCH_DIR)


def main():
    print("=" * 60)
    print("  🖨️  PrintTrack Queue Watcher")
    print(f"  📁 Watching: {WATCH_DIR}")
    print(f"  📄 Output:   {OUTPUT_FILE}")
    print(f"  📝 Log:      {LOG_FILE}")
    print("=" * 60)
    print()

    # Initial scan
    log_detection("🔍 Running initial scan...")
    result = scan_folder(WATCH_DIR)
    print(f"\n📊 Found {len(result['projects'])} projects, {len(result['files'])} files\n")

    if not HAS_WATCHDOG:
        print("Install watchdog for continuous monitoring: pip3 install watchdog")
        print("Re-run this script after installing.")
        return

    # Start watching
    observer = Observer()
    observer.schedule(PrintQueueHandler(), WATCH_DIR, recursive=False)
    observer.start()
    log_detection("👀 Watching for changes... (Ctrl+C to stop)")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        log_detection("🛑 Watcher stopped.")
    observer.join()


if __name__ == "__main__":
    main()
