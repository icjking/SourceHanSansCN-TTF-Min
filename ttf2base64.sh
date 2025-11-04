#!/bin/bash

# 检查是否提供了输入文件参数
if [ $# -ne 1 ]; then
    echo "用法: $0 <输入TTF文件路径>"
    echo "示例: ./ttf2base64.sh 字体文件.ttf"
    exit 1
fi

input_file="$1"

# 检查文件是否存在
if [ ! -f "$input_file" ]; then
    echo "错误: 文件 '$input_file' 不存在"
    exit 1
fi

# 检查文件是否为TTF文件
if [[ "$input_file" != *.ttf ]]; then
    echo "警告: 输入文件似乎不是TTF文件(扩展名不是.ttf)"
fi

# 生成输出文件名
output_file="${input_file}.base64"

# 转换为Base64编码（兼容BSD版本的base64）
echo "正在将 '$input_file' 转换为Base64编码..."
base64 -i "$input_file" -o "$output_file"

# 检查转换是否成功
if [ $? -eq 0 ]; then
    echo "转换成功！结果已保存到: $output_file"
    echo "文件大小: $(du -h "$output_file")"
else
    echo "转换失败！"
    exit 1
fi