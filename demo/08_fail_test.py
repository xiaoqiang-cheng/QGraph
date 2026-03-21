"""故意失败的脚本，用于测试错误处理"""
import sys
import time

def main():
    print("=== Fail Test ===")
    print("This script will fail intentionally.")
    time.sleep(0.5)
    print("Simulating error...")
    sys.exit(1)

if __name__ == "__main__":
    main()
