import json
import tempfile
import unittest
from pathlib import Path

from tools.version_web_export import RUNTIME_EXTENSIONS, version_export


class VersionWebExportTest(unittest.TestCase):
    def test_runtime_files_are_renamed_as_one_release(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            export_dir = Path(temporary_directory)
            (export_dir / "index.html").write_text(
                '<meta charset="utf-8"><script src="index.js"></script>'
                '<script>const GODOT_CONFIG={"executable":"index",'
                '"fileSizes":{"index.pck":12,"index.wasm":34}};</script>',
                encoding="utf-8",
            )
            for extension in RUNTIME_EXTENSIONS:
                (export_dir / f"index.{extension}").write_bytes(extension.encode())

            executable = version_export(export_dir, "abc123/unsafe")

            self.assertEqual(executable, "index-abc123unsafe")
            html = (export_dir / "index.html").read_text(encoding="utf-8")
            self.assertIn('"executable":"index-abc123unsafe"', html)
            self.assertIn("no-cache, no-store", html)
            for extension in RUNTIME_EXTENSIONS:
                self.assertFalse((export_dir / f"index.{extension}").exists())
                self.assertTrue((export_dir / f"{executable}.{extension}").is_file())
                self.assertIn(f"{executable}.{extension}", html)

            manifest = json.loads((export_dir / "release.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["executable"], executable)
            self.assertEqual(len(manifest["runtime_files"]), 3)

    def test_missing_runtime_file_fails_the_build(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            export_dir = Path(temporary_directory)
            (export_dir / "index.html").write_text('"executable":"index"', encoding="utf-8")
            with self.assertRaises(FileNotFoundError):
                version_export(export_dir, "abc123")


if __name__ == "__main__":
    unittest.main()
