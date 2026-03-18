# 🎮 VAULT.MARKET v2.0 — P2P Multiplayer Marketplace

CS2-style trading platform with **real Steam skin textures**, player-controlled market, and real-time WebSocket sync.

---

## ⚡ Быстрый старт (требуется Node.js 18+)

```bash
# 1. Установить зависимости
npm install

# 2. Запустить
npm start

# Открыть браузер:  http://localhost:3000
```

При первом запуске сервер автоматически загрузит ~700 текстур скинов с Steam CDN.

---

## 🌐 Деплой на сервер

### VPS / Ubuntu

```bash
# Установить Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Скопировать проект, установить зависимости
cd /var/www/vault-market
npm install

# Запустить через PM2 (авто-перезапуск)
npm install -g pm2
pm2 start server.js --name vault-market
pm2 save && pm2 startup
```

### Переменные окружения

```bash
PORT=8080 npm start
```

### Nginx + HTTPS

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# SSL бесплатно
certbot --nginx -d yourdomain.com
```

---

## 🏗️ Архитектура

```
vault-market/
├── server.js          — Node.js + Express + WebSocket
├── package.json
└── public/
    └── index.html     — SPA фронтенд
```

### API endpoints

| POST | `/api/auth`        | Вход / регистрация, возвращает данные игрока + маркет |
| POST | `/api/open-case`   | Открытие кейса, списывает баланс, возвращает предмет |
| POST | `/api/keep-item`   | Добавить выигранный предмет в инвентарь |
| POST | `/api/sell-won`    | Продать выигранный предмет немедленно |
| POST | `/api/list`        | Выставить предмет на маркет с ценой |
| POST | `/api/buy`         | Купить лот, деньги уходят продавцу |
| POST | `/api/cancel`      | Снять лот с продажи |
| GET  | `/api/stats`       | Статистика (онлайн, лотов, игроков) |

### WebSocket события (сервер → клиент)

| `stats`        | Онлайн / кол-во лотов                  |
| `listing_add`  | Новый лот появился на маркете          |
| `listing_rm`   | Лот снят/куплен                        |
| `activity`     | HTML-строка для ленты активности       |
| `sold`         | Твой предмет купили (уведомление)      |

---

## 🖼️ Откуда текстуры?

Сервер при запуске делает один запрос к публичному GitHub API:

```
https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json
```

Этот репозиторий содержит данные обо всех скинах CS2 включая прямые URL на Steam CDN изображения. Картинки грузятся браузером напрямую с серверов Steam.

---

## 💾 База данных (для production)

Сейчас данные в памяти. Для персистентности замени `users` и `market` Map на:

- **SQLite** (`better-sqlite3`) — для одного сервера
- **PostgreSQL** (`pg`) — для масштабирования
- **Redis** — для кешу и pub/sub между несколькими серверами

---

## 🎮 Игровые параметры (server.js)

| Параметр | Значение | Описание |
|---------|---------|---------|
| Стартовый баланс | 1500 ₡ | `balance: 1500` в auth |
| Стартовых предметов | 3 | `makeStarterItems` |
| Кейсов | 4 | массив `CASES` |
| Скинов | 64+ | по 16 в каждом кейсе |
