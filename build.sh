#!/bin/bash
os=$(uname)
echo "os is ${os}"

if [ ${os} == 'Linux' ];then
npm run build_linux
elif [ ${os} == 'Darwin' ];then
npm run build_mac
else
npm run build_win
fi