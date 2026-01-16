@echo off
echo Launching Windows 95 Scheduler...
:: Try to open in Edge App Mode (Standalone Window)
start msedge --app="%~dp0index.html"
if %errorlevel% neq 0 (
    :: Fallback to Chrome if Edge fails/missing logic (rare on Windows)
    start chrome --app="%~dp0index.html"
)
exit
