"""打印所有 QGRAPH_ 前缀的环境变量，用于测试数据传递"""
import os

def main():
    print("=== Environment Variable Test ===")
    print()

    qg_vars = {k: v for k, v in sorted(os.environ.items()) if k.startswith("QGRAPH_")}
    custom_vars = {k: v for k, v in sorted(os.environ.items())
                   if k in ("OUTPUT_DIR", "MODEL_PATH", "EPOCHS", "LEARNING_RATE",
                            "NUM_SAMPLES", "EXPORT_FORMAT", "QUANT_METHOD")}

    if qg_vars:
        print("QGraph variables:")
        for k, v in qg_vars.items():
            print(f"  {k} = {v}")
    else:
        print("No QGRAPH_ prefixed variables found.")

    print()
    if custom_vars:
        print("Custom variables:")
        for k, v in custom_vars.items():
            print(f"  {k} = {v}")
    else:
        print("No custom pipeline variables found.")

    print()
    print("Test complete!")

if __name__ == "__main__":
    main()
