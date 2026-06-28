#!/bin/bash
set -e

PANEL_DIR="/opt/shop-management-system"
PORT="320"
DEFAULT_DOMAIN="yourdomain.com"

echo "🛒 Maddix Shop Management System Installer"
echo "   Enterprise POS, Inventory, and Analytics Panel"

if [ "$EUID" -ne 0 ]; then
   echo "❌ Please run as root (sudo)"
   exit 1
fi

echo ""
echo "🛡️ Configuring Firewall Protocols (Opening Port 320)..."
if command -v ufw &> /dev/null; then
    ufw allow 320/tcp || true
    ufw reload || true
    echo "✅ UFW allowed TCP Port 320"
elif command -v iptables &> /dev/null; then
    iptables -A INPUT -p tcp --dport 320 -j ACCEPT || true
    echo "✅ Iptables allowed TCP Port 320"
fi

apt-get update -y

# Install Node.js
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Install MongoDB
if ! command -v mongod &> /dev/null; then
    echo "📦 Installing MongoDB..."
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    apt-get update -y
    apt-get install -y mongodb-org
fi

systemctl enable mongod || true
systemctl start mongod || true
sleep 2

# Install PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2 process manager..."
    npm install -g pm2
fi

# Backup old installation if exists
if [ -d "$PANEL_DIR" ]; then
    mv "$PANEL_DIR" "$PANEL_DIR.backup.$(date +%s)"
fi

mkdir -p "$PANEL_DIR"
cp -r . "$PANEL_DIR/"

# Install backend dependencies
cd "$PANEL_DIR/backend"
npm install --legacy-peer-deps

# Create .env file with Port 320
cat > "$PANEL_DIR/backend/.env" << EOF
PORT=$PORT
MONGODB_URI=mongodb://localhost:27017/shop_management_system
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_EMAIL=admin@maddix.com
ADMIN_PASSWORD=MaddixAdmin123!
EOF

# Seed database
cd "$PANEL_DIR/backend"
node -e "import('./utils/seed.js').then(m=>m.seedDB?.())" 2>/dev/null || node -e "require('./utils/seed.js').seedDB()" 2>/dev/null || true

# Start with PM2
pm2 delete shop-management-system 2>/dev/null || true
cd "$PANEL_DIR/backend"
pm2 start server.js --name shop-management-system
pm2 save

echo ""
echo "✅ Maddix Shop Management System installed successfully on Port 320!"
echo ""
echo "🌐 Access your POS and Dashboard at: http://your-server-ip:320"
echo ""
echo "Default Administrator Login:"
echo "   Email:    admin@maddix.com"
echo "   Password: MaddixAdmin123!"
echo ""
echo "📌 Features Deployed:"
echo "   - Firewall Port 320 Opened By Default"
echo "   - Enterprise-grade POS Checkout & Cart"
echo "   - Inventory CRUD Control Center"
echo "   - Admin Dashboard Metrics (Revenue, Profit, Low-Stock alerts)"
echo "   - Real-time sale synchronization via WebSockets"
echo ""
echo "Thank you for using Maddix Portal Suite!"
