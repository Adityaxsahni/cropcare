"""Decode every manifest image with TensorFlow and report the ones it cannot read.

Run after prepare_data.py. With --drop, unreadable rows are removed from the
manifest (the original is kept as manifest.before_verify.csv). Without it, the
script only reports, so no image disappears without you knowing.
"""

import argparse
import shutil
from pathlib import Path

import _bootstrap  # noqa: F401
from cropcare import manifest


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-dir", type=Path, default=Path("../data"))
    ap.add_argument("--drop", action="store_true")
    args = ap.parse_args()

    import tensorflow as tf

    path = args.data_dir / "manifest.csv"
    rows = manifest.read(path)
    bad = []
    for i, r in enumerate(rows):
        try:
            tf.io.decode_image(tf.io.read_file(str(args.data_dir / r.path)), channels=3, expand_animations=False)
        except (tf.errors.InvalidArgumentError, tf.errors.NotFoundError) as e:
            bad.append(r)
            print(f"cannot read {r.path}: {e.message.splitlines()[0]}")
        if (i + 1) % 5000 == 0:
            print(f"  checked {i + 1}/{len(rows)}")
    print(f"{len(bad)} of {len(rows)} images cannot be decoded")
    if args.drop and bad:
        shutil.copyfile(path, args.data_dir / "manifest.before_verify.csv")
        bad_set = set(bad)
        manifest.write(path, [r for r in rows if r not in bad_set])
        print(f"dropped {len(bad)} rows from {path}")


if __name__ == "__main__":
    main()
