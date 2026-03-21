"""模拟数据准备步骤"""
import json
import os
import sys
import time
from pathlib import Path

def main():
    print("=== Step 2: Preparing Data ===")

    output_dir = os.environ.get("OUTPUT_DIR", "./demo/output")
    num_samples = int(os.environ.get("NUM_SAMPLES", "100"))

    Path(output_dir).mkdir(parents=True, exist_ok=True)

    print(f"Generating {num_samples} samples...")
    for i in range(5):
        time.sleep(0.3)
        progress = (i + 1) * 20
        print(f"  Progress: {progress}%")

    data = {
        "num_samples": num_samples,
        "features": 128,
        "data_path": str(Path(output_dir) / "data.csv"),
    }

    output_file = Path(output_dir) / "data_config.json"
    output_file.write_text(json.dumps(data, indent=2))
    print(f"Data config saved to: {output_file}")
    print("Done!")

if __name__ == "__main__":
    main()
