"""
可被 Python Function 节点直接调用的函数集合。
用法：节点配置 module_path=demo.07_functions, function_name=xxx
"""
import time
import random


def generate_config(model_name: str = "resnet50", batch_size: int = 32) -> dict:
    """生成训练配置"""
    print(f"Generating config for {model_name}, batch_size={batch_size}")
    return {
        "model_name": model_name,
        "batch_size": batch_size,
        "optimizer": "adam",
        "lr": 0.001,
        "weight_decay": 1e-4,
    }


def compute_metrics(predictions: list | None = None, labels: list | None = None) -> dict:
    """计算评估指标"""
    print("Computing metrics...")
    time.sleep(0.3)
    return {
        "accuracy": round(random.uniform(0.85, 0.95), 4),
        "loss": round(random.uniform(0.05, 0.2), 4),
    }


def cleanup(output_dir: str = "./demo/output") -> dict:
    """清理临时文件"""
    print(f"Cleaning up {output_dir}...")
    time.sleep(0.2)
    return {"cleaned": True, "dir": output_dir}


async def async_health_check(url: str = "http://localhost:9800") -> dict:
    """异步健康检查示例"""
    import asyncio
    print(f"Checking health of {url}...")
    await asyncio.sleep(0.5)
    return {"status": "healthy", "url": url}
