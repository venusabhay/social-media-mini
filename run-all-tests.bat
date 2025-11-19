@echo off
setlocal enabledelayedexpansion
echo Running Unit Tests for All Microservices
echo ===========================================
echo.

set FAILED=0

REM Auth Service
echo Testing Auth Service...
cd services\auth-service
call npm test
if %ERRORLEVEL% NEQ 0 (
  set /a FAILED+=1
  echo Auth Service tests failed
) else (
  echo Auth Service tests passed
)
echo.

REM User Service
echo Testing User Service...
cd ..\user-service
call npm test
if %ERRORLEVEL% NEQ 0 (
  set /a FAILED+=1
  echo User Service tests failed
) else (
  echo User Service tests passed
)
echo.

REM Post Service
echo Testing Post Service...
cd ..\post-service
call npm test
if %ERRORLEVEL% NEQ 0 (
  set /a FAILED+=1
  echo Post Service tests failed
) else (
  echo Post Service tests passed
)
echo.

REM Summary
echo ===========================================
if !FAILED! EQU 0 (
  echo All tests passed!
  exit /b 0
) else (
  echo !FAILED! service(s) failed tests
  exit /b 1
)
