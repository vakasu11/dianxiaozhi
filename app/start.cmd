@echo off
set "DIAN_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%DIAN_NODE%" set "DIAN_NODE=node"
echo Dianxiaozhi: http://127.0.0.1:19393
echo Keep this window open. Press Ctrl+C to stop.
"%DIAN_NODE%" "%~dp0server.mjs"
pause
