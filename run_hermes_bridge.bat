@echo off
title Hermes AgentRouter Bridge (gpt-6-astra)
cd /d "D:\WhopClipper"
echo ====================================================================
echo  Starting Hermes AgentRouter Bridge on http://127.0.0.1:8318/v1
echo  Keep this window open while using Hermes!
echo ====================================================================
".venv\Scripts\python.exe" hermes_agentrouter_bridge.py
pause
