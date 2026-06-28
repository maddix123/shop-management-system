# 🛒 Maddix Shop Management System

**An enterprise-grade, lightweight, and fully customized Point-of-Sale (POS), Stock Inventory, and Business Analytics system** built in Node.js, Express, MongoDB, and Socket.io, with a beautifully styled, mobile-responsive dark theme.

---

## ⚡ Key Features

* **🛒 POS Billing & Checkout:** Real-time billing checkout, search bar for names or SKU barcodes, cashier session tracking, customer registration, discount inputs, 18% VAT automated computation, cash payment entry, change due, and printable paper invoices.
* **📦 Stock Inventory Manager:** Product directories, search and category filters, cost price vs. selling price trackers, supplier registries, and automated warning tags for low stock thresholds.
* **📊 Analytics Dashboard:** Cumulative monthly profit calculators, daily revenue meters, transaction logs, and real-time live sync alerts (via Socket.io) across all cashier terminals.
* **🛡️ Staff Account Control (RBAC):** Access roles for cashiers, managers, and administrators to ensure secure billing logs.
* **🔓 Port 320 Firewall Integration:** Automated installer rules that open port 320 on the firewall (`ufw` or `iptables`) to bypass closed protocols by default.

---

## 🚀 One-Line Installation

Copy and paste this **single command** into your Ubuntu server terminal to compile, set up firewall rules, and run the system on **Port 320** with PM2:

```bash
cd /tmp && rm -rf shop-management-system shop-management-system.zip && git clone https://github.com/maddix123/shop-management-system.git && cd shop-management-system && chmod +x install.sh && sudo bash ./install.sh
```

---

## 🔑 Administrative Settings

Navigate to your server IP on **Port 320** (e.g. `http://your-server-ip:320`) and use these default credentials:

* **Email:** `admin@maddix.com`
* **Password:** `MaddixAdmin123!`

*Please update the default administrator password in your environment immediately after installation.*

---

## 📂 Architecture

* **`backend/server.js`:** Entrypoint listening on **Port 320**.
* **`backend/models/`:** MongoDB models for User accounts, Products, Sales Invoices, Customers, Vendors, and Shop Settings.
* **`backend/routes/`:** Modular Express controllers.
* **`frontend/`:** Simple, responsive HTML5 dashboards, styles, and Socket.io bindings.

---

*Created with ❤️ for Maddix Portals.*
