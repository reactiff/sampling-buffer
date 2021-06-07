echo "Publishing..."

git add .

@echo off
set /p msg="Enter git commit message: "

git commit -m "%msg%"


echo Done
