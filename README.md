# ⚖️ LegalUZ Telegram Bot

O'zbekistondagi yuristlar va mijozlarni birlashtiruvchi professional yuridik platforma.

---

## 🚀 O'rnatish (Replit)

### 1. Environment Variables qo'shish

Replit → Secrets bo'limiga quyidagilarni qo'shing:

| Key | Qiymat |
|-----|--------|
| `TELEGRAM_BOT_TOKEN` | @BotFather dan olingan token |
| `ADMIN_TELEGRAM_ID` | Sizning Telegram ID (raqam) |
| `GEMINI_API_KEY` | https://aistudio.google.com dan |
| `DATABASE_URL` | Replit PostgreSQL avtomatik beradi |

### 2. PostgreSQL ulash

Replit → Tools → PostgreSQL → "Create Database" bosing.
`DATABASE_URL` avtomatik qo'shiladi.

### 3. Install & Run

```bash
pnpm install
pnpm dev
```

---

## 📁 Loyiha tuzilmasi

```
legaluz/
├── artifacts/
│   ├── api-server/          # Asosiy bot + API server
│   │   └── src/
│   │       ├── bot/
│   │       │   ├── index.ts      # Bot logikasi (barcha handlerlar)
│   │       │   ├── instance.ts   # Telegraf singleton
│   │       │   └── languages.ts  # 3 til (UZ/RU/EN) tarjimalari
│   │       ├── db/
│   │       │   ├── index.ts      # DB ulanish + initDb()
│   │       │   └── schema.ts     # Drizzle ORM sxemasi
│   │       ├── routes/
│   │       │   ├── webhook.ts    # Telegram webhook endpoint
│   │       │   └── health.ts     # /api/healthz
│   │       ├── services/
│   │       │   ├── ai.ts         # Google Gemini AI
│   │       │   └── subscription.ts # Obuna tekshiruvi + kesh
│   │       └── index.ts          # Server entry point
│   └── legaluz-web/         # Landing page (static)
│       └── index.html
├── package.json
├── pnpm-workspace.yaml
└── .env.example
```

---

## ⚙️ Bot bo'limlari

### Foydalanuvchi uchun:
| Bo'lim | Tavsif |
|--------|--------|
| 📢 Elon joylash | Murojaatchi yoki mutaxassis eloni |
| 🤖 AI Konsultatsiya | Gemini AI bilan yuridik savol-javob |
| 📁 Hujjatlar | Namunalar va shablonlar (kod orqali) |
| ⚖️ Huquqiy tushuntirish | Yuristlar javob beradi (guruh orqali) |
| ✍️ Hujjat tuzib berish | Yuristlar hujjat tayyorlaydi |
| 💬 Biz bilan bog'lanish | Admin bilan muloqot |

### Admin uchun (/admin):
| Bo'lim | Tavsif |
|--------|--------|
| 📊 Monitoring | Foydalanuvchilar statistikasi |
| 📢 Ommaviy post | Barcha userlarga xabar yuborish |
| 📄 Hujjat qo'shish | Namuna yoki shablon qo'shish + kod |
| 💳 To'lov kartasi | Karta qo'shish/o'chirish |

---

## 🔑 Muhim guruh IDlari

| Guruh | ID | Maqsad |
|-------|----|--------|
| E'lonlar guruhi | `-1003851523097` | Foydalanuvchi e'lonlari |
| Xizmat guruhi | `-1003900935635` | Huquqiy tushuntirish + hujjat so'rovlari |
| To'lovlar guruhi | `-1003811828588` | To'lov screenshotlari |
| Hujjatlar guruhi | `-1003821079355` | Yangi hujjat bildirisnomalar |

---

## 💡 Hujjat kodi formati

- **Namunalar**: `HA001`, `SH002`, `AR003` ...
- **Shablonlar**: `SD001`, `KD002`, `DA003` ...

Format: **2 bosh harf + 3 raqam**

---

## 🌐 Deploy (Replit)

Production rejimda `REPLIT_DOMAINS` avtomatik aniqlanadi va webhook rejim yoqiladi.

Webhook URL: `https://your-app.replit.app/api/telegram-webhook`
