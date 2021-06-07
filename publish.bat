@echo off
set /p msg="Enter git commit message: "
@echo on

git add .
git commit -m "%msg%"
git push

npm version patch
npm publish

yarn deploy

echo
echo Done!
