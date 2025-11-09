#!/bin/bash
# Kill any process running on port 8765

PORT=8765
PID=$(lsof -ti:$PORT)

if [ -z "$PID" ]; then
  echo "No process found on port $PORT"
else
  echo "Killing process $PID on port $PORT"
  kill -9 $PID
  echo "✅ Process killed"
fi


