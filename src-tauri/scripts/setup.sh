#!/bin/bash
# Camoufox 安装脚本

set -e

cd "$(dirname "$0")"

echo "========== Camoufox 安装向导 =========="
echo ""

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到 Python 3"
    echo "请先安装 Python 3.8 或更高版本"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | awk '{print $2}')
echo "✓ 检测到 Python $PYTHON_VERSION"
echo ""

# 检查 pip
if ! command -v pip3 &> /dev/null; then
    echo "❌ 错误: 未找到 pip3"
    echo "请先安装 pip"
    exit 1
fi

echo "步骤 1/3: 安装 Python 依赖..."
pip3 install -r requirements.txt --quiet
echo "✓ Python 依赖安装完成"
echo ""

echo "步骤 2/3: 下载 Camoufox 浏览器..."
python3 -m camoufox fetch
echo "✓ Camoufox 浏览器下载完成"
echo ""

echo "步骤 3/3: 验证安装..."
python3 -c "from camoufox.async_api import AsyncCamoufox; print('✓ Camoufox 安装成功')"
echo ""

echo "========================================="
echo "✅ Camoufox 安装完成！"
echo ""
echo "现在可以使用账号注册功能了。"
echo "========================================="
