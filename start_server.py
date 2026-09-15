import subprocess
import time
import sys

# Start the server
proc = subprocess.Popen(
    [sys.executable, r"C:\Users\erand.bazaj\OneDrive - Academedia\Documents\MyAI\backend\server.py"],
    cwd=r"C:\Users\erand.bazaj\OneDrive - Academedia\Documents\MyAI",
    creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
)

print(f"Server started with PID: {proc.pid}")
print("Press Ctrl+C to stop")

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    proc.terminate()
    print("Server stopped")
