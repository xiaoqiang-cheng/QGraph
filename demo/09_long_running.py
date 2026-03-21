"""模拟长时间运行的任务，用于测试暂停/停止功能"""
import time
import sys

def main():
    total = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    print(f"=== Long Running Task ({total}s) ===")

    for i in range(1, total + 1):
        time.sleep(1)
        bar = "█" * i + "░" * (total - i)
        print(f"\r  [{bar}] {i}/{total}s", flush=True)

    print("\nLong running task complete!")

if __name__ == "__main__":
    main()
