#!/bin/bash
# VPS setup script — run as root on Hetzner CX23 (49.12.225.253)
set -e

echo "=== Invoice Routing Intelligence — VPS Setup ==="
echo "Target: demo.inspirationtechcorp.com"

# 1. System update
apt update && apt upgrade -y

# 2. Install system dependencies
apt install -y \
    python3.12 python3.12-venv python3-pip \
    nginx certbot python3-certbot-nginx \
    git curl wget \
    build-essential libssl-dev \
    poppler-utils \
    libpq-dev

# 3. Install Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version
npm --version

# 4. Create directory structure
mkdir -p /var/www/invoice-router/{backend,frontend,uploads,exports,logs}
mkdir -p /var/www/invoice-router/watched/incoming
mkdir -p /var/www/invoice-router/watched/processed/{vendors,review_queue,errors}
touch /var/www/invoice-router/watched/incoming/.gitkeep

# 5. Clone repository (update URL if needed)
cd /var/www/invoice-router
if [ -d ".git" ]; then
    git pull origin main
else
    git clone https://github.com/Towoadeyemi1/lrw-vep-ub2026.git .
fi

# 6. Create Python virtual environment
python3.12 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

# 7. Build frontend
cd /var/www/invoice-router/frontend
npm ci
npm run build

# 8. Create .env file (EDIT THIS — add your Anthropic API key)
cat > /var/www/invoice-router/backend/.env << 'ENVEOF'
ANTHROPIC_API_KEY=sk-ant-YOUR_ANTHROPIC_API_KEY_HERE
DEMO_ACCESS_PASSWORD=InvoiceDemo2026
HOST=demo.inspirationtechcorp.com
SECRET_KEY=REPLACE_WITH_64_CHAR_RANDOM_STRING
DATABASE_URL=sqlite:////var/www/invoice-router/invoice_routing.db
UPLOAD_DIR=/var/www/invoice-router/uploads
EXPORT_DIR=/var/www/invoice-router/exports
GMAIL_EMAIL=invoices.inspirationtechcorp@gmail.com
GMAIL_APP_PASSWORD=dcda uclw duty hsir
GMAIL_IMAP_SERVER=imap.gmail.com
GMAIL_IMAP_PORT=993
EMAIL_CHECK_INTERVAL=60
ENVEOF

echo ""
echo "!!! IMPORTANT: Edit /var/www/invoice-router/backend/.env and set your ANTHROPIC_API_KEY"
echo ""

# 9. Set permissions
chown -R www-data:www-data /var/www/invoice-router
chmod -R 755 /var/www/invoice-router
chmod 600 /var/www/invoice-router/backend/.env

# 10. Install nginx config
cp /var/www/invoice-router/nginx.conf /etc/nginx/sites-available/invoice-router
ln -sf /etc/nginx/sites-available/invoice-router /etc/nginx/sites-enabled/invoice-router
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 11. Get SSL certificate
certbot --nginx \
    -d demo.inspirationtechcorp.com \
    --non-interactive \
    --agree-tos \
    --email towo@inspirationtechcorp.com \
    --redirect

# 12. Install and start systemd service
cp /var/www/invoice-router/invoice-router.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable invoice-router
systemctl start invoice-router

# 13. Verify
echo ""
echo "=== Verification ==="
echo "Service status:"
systemctl status invoice-router --no-pager

echo ""
echo "API health check:"
sleep 3
curl -s http://localhost:8000/api/health || echo "API not yet ready — check: journalctl -u invoice-router -f"

echo ""
echo "=== SETUP COMPLETE ==="
echo "Visit: https://demo.inspirationtechcorp.com"
echo "Password: InvoiceDemo2026"
echo ""
echo "Next steps:"
echo "1. Add your ANTHROPIC_API_KEY to /var/www/invoice-router/backend/.env"
echo "2. Run: systemctl restart invoice-router"
echo "3. Test: curl https://demo.inspirationtechcorp.com/api/health"
