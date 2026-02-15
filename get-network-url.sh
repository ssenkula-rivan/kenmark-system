#!/bin/bash

# Script to get the network URL for accessing the system from other computers

echo "=========================================="
echo "  Kenmark System - Network Access"
echo "=========================================="
echo ""

# Get the IP address
IP=$(ipconfig getifaddr en0 2>/dev/null)

if [ -z "$IP" ]; then
    # Try alternative method
    IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
fi

if [ -z "$IP" ]; then
    echo "❌ Could not detect IP address"
    echo ""
    echo "Please run manually:"
    echo "  ifconfig | grep 'inet '"
    exit 1
fi

echo "✅ Server IP Address: $IP"
echo ""
echo "📱 Share this URL with other computers on your network:"
echo ""
echo "   http://$IP:3000"
echo ""
echo "=========================================="
echo ""
echo "Instructions:"
echo "1. Make sure both servers are running:"
echo "   - Backend: npm start"
echo "   - Frontend: cd frontend && npm run dev"
echo ""
echo "2. Other computers must be on the same WiFi/network"
echo ""
echo "3. Open the URL above in any browser"
echo ""
echo "=========================================="
