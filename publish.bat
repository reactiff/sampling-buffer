@echo off
set /p msg="Enter git commit message: "
@echo on

git add .
git commit -m "%msg%"
git push

call npm version patch
call npm publish

yarn deploy

echo
echo Done!
