#!/bin/bash

echo "============================================"
echo "   MyAI - Installation Script"
echo "============================================"
echo

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python3 is not installed!"
    echo "Please install Python3 from https://www.python.org/downloads/"
    exit 1
fi

echo "[1/4] Installing Python dependencies..."
pip3 install -r backend/requirements.txt

echo
echo "[2/4] Checking for Ollama..."
if ! command -v ollama &> /dev/null; then
    echo "[WARNING] Ollama is not installed!"
    echo
    echo "Please install Ollama from: https://ollama.ai/download"
    echo "After installing, run: ollama pull llama3.2"
    echo
    read -p "Press Enter to continue anyway..."
else
    echo "[OK] Ollama is installed"
fi

echo
echo "[3/4] Checking for AI models..."
if ! ollama list &> /dev/null; then
    echo "[INFO] No models found. Pulling llama3.2..."
    echo "This may take a few minutes..."
    ollama pull llama3.2
else
    echo "[OK] Models available"
    ollama list
fi

echo
echo "[4/4] Starting MyAI..."
echo
echo "============================================"
echo "   MyAI is starting!"
echo "============================================"
echo
echo "   Open your browser and go to:"
echo "   http://localhost:5000"
echo
echo "   Press Ctrl+C to stop the server"
echo "============================================"
echo

python3 backend/server.py
