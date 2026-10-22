"""Start the server: `python -m app` (from the backend folder).

Reads the port from $PORT (Render sets it; 10000 is Render's default), so the
start command needs no shell variable that can be mistyped.
"""

import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:create_app", factory=True, host="0.0.0.0", port=int(os.environ.get("PORT") or 10000))
