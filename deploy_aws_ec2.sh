#!/usr/bin/env bash
# ==============================================================================
# MAXSHOW - AWS EC2 / Lightsail Production Auto-Deployment Script
# Works on Ubuntu 20.04 / 22.04 / 24.04 LTS
# ==============================================================================

set -e

echo "======================================================"
echo "🚀 Starting MAXSHOW AWS Production Deployment"
echo "======================================================"

# 1. Update system packages
echo "[1/6] Updating system packages..."
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y python3 python3-pip python3-venv git curl nginx ufw

# 2. Install Node.js (v20 LTS)
echo "[2/6] Setting up Node.js 20 LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo "Node $(node -v) and NPM $(npm -v) installed."

# 3. Build Frontend
echo "[3/6] Building React Frontend..."
cd /var/www/maxshow/Frontend || cd ./Frontend
npm ci
npm run build
cd ..

# 4. Setup Python Backend Virtual Environment
echo "[4/6] Setting up Python Virtual Environment..."
cd /var/www/maxshow || cd .
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r Backend/requirements.txt

# 5. Create Systemd Service for FastAPI
echo "[5/6] Configuring systemd background service..."
sudo bash -c 'cat > /etc/systemd/system/maxshow.service <<EOF
[Unit]
Description=MAXSHOW FastAPI Production Application
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/var/www/maxshow
ExecStart=/var/www/maxshow/.venv/bin/python -m uvicorn Backend.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5
Environment="PATH=/var/www/maxshow/.venv/bin:/usr/bin"

[Install]
WantedBy=multi-user.target
EOF'

sudo systemctl daemon-reload
sudo systemctl enable maxshow
sudo systemctl restart maxshow

# 6. Configure Nginx Reverse Proxy
echo "[6/6] Configuring Nginx Web Server..."
sudo bash -c 'cat > /etc/nginx/sites-available/maxshow <<EOF
server {
    listen 80;
    server_name _;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # SSE Buffering off for real-time live stream
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }
}
EOF'

sudo ln -sf /etc/nginx/sites-available/maxshow /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Allow ports in Firewall
sudo ufw allow 'Nginx Full' || true
sudo ufw allow 22/tcp || true

echo "======================================================"
echo "✅ MAXSHOW is successfully deployed and running on AWS!"
echo "Public IP: $(curl -s http://checkip.amazonaws.com || curl -s https://ifconfig.me)"
echo "======================================================"
