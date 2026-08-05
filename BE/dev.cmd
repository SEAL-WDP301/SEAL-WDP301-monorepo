@echo off
cd /d %~dp0
node --max-old-space-size=4096 node_modules\@nestjs\cli\bin\nest.js start --watch
