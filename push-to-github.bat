@echo off
cd /d "%~dp0"
echo.
echo  ============================================
echo    把本站推送到 GitHub
echo  ============================================
echo.
echo  先在浏览器打开 https://github.com/new 建一个空仓库：
echo    - Repository name 填个名字，比如 abrams
echo    - 选 Public
echo    - 不要勾 Add a README / .gitignore / license
echo.
set /p GHUSER=你的 GitHub 用户名: 
set /p GHREPO=仓库名: 
if "%GHUSER%"=="" goto empty
if "%GHREPO%"=="" goto empty
echo.
echo  设置远程地址...
git remote remove origin >nul 2>&1
git remote add origin https://github.com/%GHUSER%/%GHREPO%.git
echo  开始推送。第一次会弹出浏览器让你登录/授权，按提示走完。
echo.
git push -u origin main
echo.
echo  ---- 推送结束 ----
echo  如果上面显示成功，去仓库页 Settings - Pages：
echo    Source: Deploy from a branch
echo    Branch: main  /  (root)  然后 Save
echo  等 1-2 分钟，打开：https://%GHUSER%.github.io/%GHREPO%/
echo.
pause
exit /b 0
:empty
echo.
echo  用户名和仓库名都不能为空，请重新运行。
echo.
pause
exit /b 1
