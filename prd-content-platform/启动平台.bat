@echo off
chcp 65001 >nul
title AI 交互题生产平台

echo.
echo  ╔══════════════════════════════════════╗
echo  ║   AI 交互题自主生产平台              ║
echo  ╚══════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo  [1/2] 检查环境...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  ✕ 未检测到 Node.js，请先安装: https://nodejs.org
    pause
    exit /b 1
)

if not exist node_modules (
    echo  [1/2] 首次运行，安装依赖中...
    call npm install
)

echo  [2/2] 启动服务器...
echo.
echo  ────────────────────────────────────────
echo   启动后请在浏览器打开以下地址：
echo.
echo   本机访问:   http://localhost:3200
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        echo   局域网访问: http://%%b:3200
    )
)

echo.
echo   按 Ctrl+C 可停止服务器
echo  ────────────────────────────────────────
echo.

node server/index.js

pause
