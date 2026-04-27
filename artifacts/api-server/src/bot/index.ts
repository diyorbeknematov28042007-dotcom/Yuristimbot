import type { Telegraf } from 'telegraf';
import { Markup } from 'telegraf';
import { db, pool } from '../db/index.js';
import { t, type Lang } from './languages.js';
import { checkSubscription, clearSubscriptionCache } from '../services/subscription.js';
import { askGemini, splitLongMessage } from '../services/ai.js';
import type { SessionData } from './instance.js';

type MyContext = import('telegraf').Context & { session: SessionData };

// ─── GROUP / CHANNEL IDs ────────────────────────────────────────────────────
const ADS_GROUP_ID = -1003851523097;
const SERVICE_GROUP_ID = -1003900935635; // Xizmat guruhi (huquqiy tushuntirish, hujjat tuzish)
const PAYMENT_GROUP_ID = -1003811828588; // To'lovlar guruhi
const DOCS_GROUP_ID = -1003821079355; // Hujjatlar guruhi

// ─── KEYBOARDS ──────────────────────────────────────────────────────────────
function mainMenuKeyboard(lang: Lang) {
  const T = t(lang);
  return Markup.keyboard([
    [T.btnAds, T.btnAI],
    [T.btnDocs, T.btnAdmin],
    [T.btnLegalConsult, T.btnDocCreate],
  ]).resize();
}

function cancelKeyboard(lang: Lang) {
  return Markup.keyboard([[t(lang).btnCancel]]).resize();
}

function backKeyboard(lang: Lang) {
  return Markup.keyboard([[t(lang).btnMainMenu]]).resize();
}

function langKeyboard() {
  return Markup.keyboard([['🇺🇿 O\'zbek', '🇷🇺 Русский', '🇬🇧 English']]).resize();
}

function adTypeKeyboard(lang: Lang) {
  const T = t(lang);
  return Markup.keyboard([
    [T.btnClientAd, T.btnSpecialistAd],
    [T.btnMainMenu],
  ]).resize();
}

function subscribeKeyboard(lang: Lang) {
  const T = t(lang);
  return Markup.inlineKeyboard([
    [Markup.button.url('📢 @LegalUz_Y_u', 'https://t.me/LegalUz_Y_u')],
    [Markup.button.url('📢 @LegalUz_M_u', 'https://t.me/LegalUz_M_u')],
    [Markup.button.url('📢 @Yurist_ND', 'https://t.me/Yurist_ND')],
    [Markup.button.url('📁 Papka', 'https://t.me/addlist/LAV6HuGmEOJlOGVi')],
    [Markup.button.callback(T.checkSubscription, 'check_subscription')],
  ]);
}

function docSectionKeyboard(lang: Lang) {
  const T = t(lang);
  return Markup.keyboard([
    [T.btnDocSamples, T.btnDocTemplates],
    [T.btnMainMenu],
  ]).resize();
}

function docSampleCategoryKeyboard(lang: Lang) {
  const T = t(lang);
  return Markup.keyboard([
    [T.btnSudHujjatlari, T.btnArizalar],
    [T.btnShartnomaMisollari, T.btnBoshqaHujjatlar],
    [T.btnMainMenu],
  ]).resize();
}

function templateCategoryKeyboard(lang: Lang) {
  const T = t(lang);
  return Markup.keyboard([
    [T.btnShartnomalar, T.btnDavoArizalari],
    [T.btnKorporativHujjatlar, T.btnTemplateBoshqa],
    [T.btnMainMenu],
  ]).resize();
}

// Admin keyboards
function adminPanelKeyboard(lang: Lang) {
  const T = t(lang);
  return Markup.keyboard([
    [T.btnAdminMonitor, T.btnAdminBroadcast],
    [T.btnAdminAddDoc, T.btnAdminPayment],
    [T.btnMainMenu],
  ]).resize();
}

function adminDocTypeKeyboard(lang: Lang) {
  const T = t(lang);
  return Markup.keyboard([
    [T.btnSampleDoc, T.btnTemplateDoc],
    [T.btnMainMenu],
  ]).resize();
}

function adminSampleCategoryKeyboard(lang: Lang) {
  const T = t(lang);
  return Markup.keyboard([
    [T.btnSudHujjatlari, T.btnArizalar],
    [T.btnShartnomaMisollari, T.btnBoshqaHujjatlar],
    [T.btnMainMenu],
  ]).resize();
}

function adminTemplateCategoryKeyboard(lang: Lang) {
  const T = t(lang);
  return Markup.keyboard([
    [T.btnShartnomalar, T.btnDavoArizalari],
    [T.btnKorporativHujjatlar, T.btnTemplateBoshqa],
    [T.btnMainMenu],
  ]).resize();
}

function adminPaymentKeyboard(lang: Lang) {
  const T = t(lang);
  return Markup.keyboard([
    [T.btnAddCard, T.btnRemoveCard],
    [T.btnViewCards, T.btnMainMenu],
  ]).resize();
}

// ─── HELPERS ────────────────────────────────────────────────────────────────
function isAdmin(ctx: MyContext): boolean {
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  if (!adminId) return false;
  return String(ctx.from?.id) === adminId;
}

async function saveOrUpdateUser(ctx: MyContext, lang: Lang) {
  const u = ctx.from!;
  await pool.query(
    `INSERT INTO bot_users (telegram_id, username, first_name, last_name, language)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (telegram_id) DO UPDATE SET language = $5, username = $2, first_name = $3, last_name = $4`,
    [String(u.id), u.username || null, u.first_name || null, (u as any).last_name || null, lang]
  );
}

async function getActiveCard(): Promise<{ card_number: string; owner_name: string } | null> {
  const res = await pool.query(
    `SELECT card_number, owner_name FROM payment_cards WHERE is_active = true ORDER BY id DESC LIMIT 1`
  );
  return res.rows[0] || null;
}

function mapButtonToCategory(btn: string, lang: Lang): { category: string; docType: 'sample' | 'template' } | null {
  const T = t(lang);
  const map: Record<string, { category: string; docType: 'sample' | 'template' }> = {
    [T.btnSudHujjatlari]: { category: 'sud', docType: 'sample' },
    [T.btnArizalar]: { category: 'ariza', docType: 'sample' },
    [T.btnShartnomaMisollari]: { category: 'shartnoma_misol', docType: 'sample' },
    [T.btnBoshqaHujjatlar]: { category: 'boshqa', docType: 'sample' },
    [T.btnShartnomalar]: { category: 'shartnoma', docType: 'template' },
    [T.btnDavoArizalari]: { category: 'davo', docType: 'template' },
    [T.btnKorporativHujjatlar]: { category: 'korporativ', docType: 'template' },
    [T.btnTemplateBoshqa]: { category: 'template_boshqa', docType: 'template' },
  };
  return map[btn] || null;
}

async function showDocList(ctx: MyContext, category: string, docType: 'sample' | 'template') {
  const lang = ctx.session.language;
  const T = t(lang);

  const res = await pool.query(
    `SELECT id, title_uz, title_ru, title_en, code, price, is_paid FROM legal_documents WHERE category = $1 AND doc_type = $2 ORDER BY id`,
    [category, docType]
  );

  if (!res.rows.length) {
    await ctx.reply(T.docsEmpty, backKeyboard(lang));
    return;
  }

  const titleField = lang === 'uz' ? 'title_uz' : lang === 'ru' ? 'title_ru' : 'title_en';
  const buttons = res.rows.map((doc: any) => {
    const paidMark = doc.is_paid ? ' ⭐' : ' ✅';
    const label = `${doc[titleField]}${paidMark} [${doc.code}]`;
    return [Markup.button.callback(label, `doc_${doc.id}`)];
  });

  await ctx.reply(
    lang === 'uz'
      ? `📋 Hujjatlar ro'yxati:\n\n✅ — Bepul  ⭐ — Pullik`
      : lang === 'ru'
      ? `📋 Список документов:\n\n✅ — Бесплатно  ⭐ — Платно`
      : `📋 Document list:\n\n✅ — Free  ⭐ — Paid`,
    Markup.inlineKeyboard(buttons)
  );
}

// ─── BOT SETUP ──────────────────────────────────────────────────────────────
export function setupBot(bot: Telegraf<MyContext>) {
  // ── /start ──
  bot.start(async (ctx) => {
    ctx.session.step = 'language_select';
    ctx.session.adData = {};
    ctx.session.adType = null;
    await ctx.reply(
      '🌐 Tilni tanlang / Выберите язык / Select language:',
      langKeyboard()
    );
  });

  // ── Language selection ──
  bot.hears("🇺🇿 O'zbek", async (ctx) => {
    ctx.session.language = 'uz';
    await handleAfterLanguage(ctx);
  });
  bot.hears('🇷🇺 Русский', async (ctx) => {
    ctx.session.language = 'ru';
    await handleAfterLanguage(ctx);
  });
  bot.hears('🇬🇧 English', async (ctx) => {
    ctx.session.language = 'en';
    await handleAfterLanguage(ctx);
  });

  async function handleAfterLanguage(ctx: MyContext) {
    const lang = ctx.session.language;
    const T = t(lang);
    await saveOrUpdateUser(ctx, lang);
    await ctx.reply(T.welcome, { parse_mode: 'HTML' });
    ctx.session.step = 'subscribe_check';
    await ctx.reply(T.subscribeRequired, { parse_mode: 'HTML', ...subscribeKeyboard(lang) });
  }

  // ── Subscription check callback ──
  bot.action('check_subscription', async (ctx) => {
    await ctx.answerCbQuery();
    const lang = ctx.session.language || 'uz';
    const T = t(lang);
    const userId = String(ctx.from!.id);
    clearSubscriptionCache(userId);
    const subscribed = await checkSubscription(bot, userId);

    if (!subscribed) {
      await ctx.reply(T.notSubscribed, subscribeKeyboard(lang));
      return;
    }

    clearSubscriptionCache(userId);
    ctx.session.step = 'main_menu';
    await ctx.reply(T.subscribed);
    await ctx.reply(T.selectSection, mainMenuKeyboard(lang));
  });

  // ── Guard: check subscription before all main actions ──
  async function guardSubscription(ctx: MyContext): Promise<boolean> {
    const lang = ctx.session.language || 'uz';
    const T = t(lang);
    const userId = String(ctx.from!.id);
    const subscribed = await checkSubscription(bot, userId);
    if (!subscribed) {
      ctx.session.step = 'subscribe_check';
      await ctx.reply(T.subscribeRequired, { parse_mode: 'HTML', ...subscribeKeyboard(lang) });
      return false;
    }
    return true;
  }

  // ── Cancel / Main menu ──
  const cancelHandler = async (ctx: MyContext) => {
    const lang = ctx.session.language || 'uz';
    ctx.session.step = 'main_menu';
    ctx.session.adData = {};
    ctx.session.adType = null;
    ctx.session.adminDocFlow = undefined;
    ctx.session.serviceType = undefined;
    ctx.session.pendingDocCode = undefined;
    await ctx.reply(t(lang).cancel, mainMenuKeyboard(lang));
  };

  bot.hears((text, ctx) => {
    const lang = (ctx as any).session?.language || 'uz';
    return text === t(lang as Lang).btnCancel || text === t(lang as Lang).btnMainMenu;
  }, cancelHandler);

  // ── 📢 ADS ──
  bot.hears((text, ctx) => text === t((ctx as any).session?.language || 'uz').btnAds, async (ctx) => {
    if (!(await guardSubscription(ctx))) return;
    const lang = ctx.session.language;
    ctx.session.step = 'ads_type';
    await ctx.reply(t(lang).selectAdType, adTypeKeyboard(lang));
  });

  // Ad type selection
  bot.hears((text, ctx) => text === t((ctx as any).session?.language || 'uz').btnClientAd, async (ctx) => {
    if (ctx.session.step !== 'ads_type') return;
    const lang = ctx.session.language;
    ctx.session.adType = 'client';
    ctx.session.step = 'ad_field';
    await ctx.reply(t(lang).clientAdField, cancelKeyboard(lang));
  });

  bot.hears((text, ctx) => text === t((ctx as any).session?.language || 'uz').btnSpecialistAd, async (ctx) => {
    if (ctx.session.step !== 'ads_type') return;
    const lang = ctx.session.language;
    ctx.session.adType = 'specialist';
    ctx.session.step = 'ad_field';
    await ctx.reply(t(lang).specialistAdField, cancelKeyboard(lang));
  });

  // ── 🤖 AI ──
  bot.hears((text, ctx) => text === t((ctx as any).session?.language || 'uz').btnAI, async (ctx) => {
    if (!(await guardSubscription(ctx))) return;
    const lang = ctx.session.language;
    ctx.session.step = 'ai_chat';
    await ctx.reply(t(lang).aiWelcome, { parse_mode: 'HTML', ...cancelKeyboard(lang) });
  });

  // ── 📁 DOCS ──
  bot.hears((text, ctx) => text === t((ctx as any).session?.language || 'uz').btnDocs, async (ctx) => {
    if (!(await guardSubscription(ctx))) return;
    const lang = ctx.session.language;
    ctx.session.step = 'docs_main';
    await ctx.reply(t(lang).docsWelcome, { parse_mode: 'HTML', ...docSectionKeyboard(lang) });
  });

  // Doc samples
  bot.hears((text, ctx) => text === t((ctx as any).session?.language || 'uz').btnDocSamples, async (ctx) => {
    const lang = ctx.session.language;
    ctx.session.step = 'docs_samples';
    await ctx.reply(t(lang).docSampleCategories, docSampleCategoryKeyboard(lang));
  });

  // Doc templates
  bot.hears((text, ctx) => text === t((ctx as any).session?.language || 'uz').btnDocTemplates, async (ctx) => {
    const lang = ctx.session.language;
    ctx.session.step = 'docs_templates';
    await ctx.reply(t(lang).templateCategories, templateCategoryKeyboard(lang));
  });

  // Doc category selection (samples)
  const sampleCats = ['btnSudHujjatlari', 'btnArizalar', 'btnShartnomaMisollari', 'btnBoshqaHujjatlar'] as const;
  const templateCats = ['btnShartnomalar', 'btnDavoArizalari', 'btnKorporativHujjatlar', 'btnTemplateBoshqa'] as const;

  [...sampleCats, ...templateCats].forEach((key) => {
    bot.hears(
      (text, ctx) => text === t((ctx as any).session?.language || 'uz')[key],
      async (ctx) => {
        const lang = ctx.session.language;
        const mapped = mapButtonToCategory(ctx.message.text, lang);
        if (!mapped) return;
        ctx.session.step = `docs_cat_${mapped.category}`;
        await showDocList(ctx, mapped.category, mapped.docType);
      }
    );
  });

  // Doc callback (inline button press)
  bot.action(/^doc_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const lang = ctx.session.language;
    const T = t(lang);
    const docId = parseInt(ctx.match[1]);
    const res = await pool.query(`SELECT * FROM legal_documents WHERE id = $1`, [docId]);
    const doc = res.rows[0];
    if (!doc) return;

    const titleField = lang === 'uz' ? 'title_uz' : lang === 'ru' ? 'title_ru' : 'title_en';
    const docName = doc[titleField];

    if (doc.is_paid && doc.price > 0) {
      const card = await getActiveCard();
      if (card) {
        ctx.session.pendingDocCode = doc.code;
        ctx.session.step = 'awaiting_payment_screenshot';
        await ctx.reply(
          T.docPaidMsg(docName, doc.price, card.card_number, card.owner_name),
          { parse_mode: 'HTML' }
        );
      } else {
        await ctx.reply('💳 To\'lov kartasi hozircha mavjud emas. Admin bilan bog\'laning.');
      }
      return;
    }

    // Free document
    try {
      await ctx.replyWithDocument(doc.file_id, { caption: `📄 ${docName}` });
    } catch {
      await ctx.reply('❌ Hujjat topilmadi.');
    }
  });

  // ── ⚖️ LEGAL CONSULT ──
  bot.hears((text, ctx) => text === t((ctx as any).session?.language || 'uz').btnLegalConsult, async (ctx) => {
    if (!(await guardSubscription(ctx))) return;
    const lang = ctx.session.language;
    ctx.session.step = 'legal_consult_desc';
    ctx.session.serviceType = 'legal_consult';
    await ctx.reply(t(lang).legalConsultWelcome, { parse_mode: 'HTML', ...cancelKeyboard(lang) });
  });

  // ── ✍️ DOC CREATE ──
  bot.hears((text, ctx) => text === t((ctx as any).session?.language || 'uz').btnDocCreate, async (ctx) => {
    if (!(await guardSubscription(ctx))) return;
    const lang = ctx.session.language;
    ctx.session.step = 'doc_create_desc';
    ctx.session.serviceType = 'doc_create';
    await ctx.reply(t(lang).docCreateWelcome, { parse_mode: 'HTML', ...cancelKeyboard(lang) });
  });

  // ── 💬 CONTACT / SUPPORT ──
  bot.hears((text, ctx) => text === t((ctx as any).session?.language || 'uz').btnAdmin, async (ctx) => {
    if (!(await guardSubscription(ctx))) return;
    const lang = ctx.session.language;
    ctx.session.step = 'admin_msg';
    ctx.session.serviceType = 'admin_msg';
    await ctx.reply(t(lang).adminWelcome, { parse_mode: 'HTML', ...cancelKeyboard(lang) });
  });

  // ── ADMIN PANEL (/admin command) ──
  bot.command('admin', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const lang = ctx.session.language || 'uz';
    ctx.session.step = 'admin_panel';
    await ctx.reply(t(lang).adminPanel, { parse_mode: 'HTML', ...adminPanelKeyboard(lang) });
  });

  // Admin panel buttons
  bot.hears((text, ctx) => isAdmin(ctx) && text === t((ctx as any).session?.language || 'uz').btnAdminMonitor, async (ctx) => {
    const usersRes = await pool.query(`SELECT COUNT(*) FROM bot_users`);
    const todayRes = await pool.query(
      `SELECT COUNT(*) FROM bot_users WHERE created_at >= NOW() - INTERVAL '1 day'`
    );
    const adsRes = await pool.query(`SELECT COUNT(*) FROM ads`);
    const lang = ctx.session.language;
    await ctx.reply(
      t(lang).monitoringInfo(
        parseInt(usersRes.rows[0].count),
        parseInt(todayRes.rows[0].count),
        parseInt(adsRes.rows[0].count)
      ),
      { parse_mode: 'HTML' }
    );
  });

  bot.hears((text, ctx) => isAdmin(ctx) && text === t((ctx as any).session?.language || 'uz').btnAdminBroadcast, async (ctx) => {
    const lang = ctx.session.language;
    ctx.session.step = 'admin_broadcast';
    await ctx.reply(t(lang).adminBroadcastPrompt, cancelKeyboard(lang));
  });

  bot.hears((text, ctx) => isAdmin(ctx) && text === t((ctx as any).session?.language || 'uz').btnAdminAddDoc, async (ctx) => {
    const lang = ctx.session.language;
    ctx.session.step = 'admin_doc_type';
    ctx.session.adminDocFlow = {};
    await ctx.reply(t(lang).adminAddDocType, adminDocTypeKeyboard(lang));
  });

  bot.hears((text, ctx) => isAdmin(ctx) && text === t((ctx as any).session?.language || 'uz').btnSampleDoc, async (ctx) => {
    if (ctx.session.step !== 'admin_doc_type') return;
    const lang = ctx.session.language;
    ctx.session.adminDocFlow = { docType: 'sample' };
    ctx.session.step = 'admin_doc_category';
    await ctx.reply(t(lang).adminAddDocCategory, adminSampleCategoryKeyboard(lang));
  });

  bot.hears((text, ctx) => isAdmin(ctx) && text === t((ctx as any).session?.language || 'uz').btnTemplateDoc, async (ctx) => {
    if (ctx.session.step !== 'admin_doc_type') return;
    const lang = ctx.session.language;
    ctx.session.adminDocFlow = { docType: 'template' };
    ctx.session.step = 'admin_doc_category';
    await ctx.reply(t(lang).adminAddDocCategory, adminTemplateCategoryKeyboard(lang));
  });

  // Admin doc category selection
  const allDocCategories = [...sampleCats, ...templateCats];
  allDocCategories.forEach((key) => {
    bot.hears(
      (text, ctx) => isAdmin(ctx) && ctx.session.step === 'admin_doc_category' && text === t((ctx as any).session?.language || 'uz')[key],
      async (ctx) => {
        const lang = ctx.session.language;
        const mapped = mapButtonToCategory(ctx.message.text, lang);
        if (!mapped) return;
        ctx.session.adminDocFlow = { ...ctx.session.adminDocFlow, category: mapped.category };
        ctx.session.step = 'admin_doc_file';
        await ctx.reply(t(lang).adminAddDocFile, cancelKeyboard(lang));
      }
    );
  });

  bot.hears((text, ctx) => isAdmin(ctx) && text === t((ctx as any).session?.language || 'uz').btnAdminPayment, async (ctx) => {
    const lang = ctx.session.language;
    ctx.session.step = 'admin_payment_menu';
    await ctx.reply(t(lang).adminPaymentMenu, adminPaymentKeyboard(lang));
  });

  bot.hears((text, ctx) => isAdmin(ctx) && text === t((ctx as any).session?.language || 'uz').btnAddCard, async (ctx) => {
    const lang = ctx.session.language;
    ctx.session.step = 'admin_card_owner';
    ctx.session.cardFlow = {};
    await ctx.reply(t(lang).adminCardOwner, cancelKeyboard(lang));
  });

  bot.hears((text, ctx) => isAdmin(ctx) && text === t((ctx as any).session?.language || 'uz').btnViewCards, async (ctx) => {
    const lang = ctx.session.language;
    const res = await pool.query(`SELECT * FROM payment_cards WHERE is_active = true ORDER BY id`);
    if (!res.rows.length) {
      await ctx.reply(t(lang).noCards);
      return;
    }
    const list = res.rows.map((c: any) => `💳 ${c.id}. ${c.owner_name}: ${c.card_number}`).join('\n');
    await ctx.reply(`💳 Kartalar:\n\n${list}`);
  });

  bot.hears((text, ctx) => isAdmin(ctx) && text === t((ctx as any).session?.language || 'uz').btnRemoveCard, async (ctx) => {
    const lang = ctx.session.language;
    ctx.session.step = 'admin_card_remove';
    await ctx.reply('🗑️ O\'chirish uchun karta ID sini yozing:', cancelKeyboard(lang));
  });

  // ── MESSAGE HANDLER (all text) ──
  bot.on('message', async (ctx) => {
    const lang = ctx.session.language || 'uz';
    const T = t(lang);
    const step = ctx.session.step || 'start';
    const msg = ctx.message as any;
    const text = msg.text || '';

    // ─── AD STEPS ──────────────────────────────────────────────────────────
    if (step === 'ad_field') {
      ctx.session.adData.field = text;
      ctx.session.step = 'ad_region';
      const prompt = ctx.session.adType === 'client' ? T.clientAdRegion : T.specialistAdRegion;
      await ctx.reply(prompt, cancelKeyboard(lang));
      return;
    }

    if (step === 'ad_region') {
      ctx.session.adData.region = text;
      if (ctx.session.adType === 'specialist') {
        ctx.session.step = 'ad_experience';
        await ctx.reply(T.specialistAdExperience, cancelKeyboard(lang));
      } else {
        ctx.session.step = 'ad_description';
        await ctx.reply(T.clientAdDescription, cancelKeyboard(lang));
      }
      return;
    }

    if (step === 'ad_experience') {
      ctx.session.adData.experience = text;
      ctx.session.step = 'ad_price';
      await ctx.reply(T.specialistAdPrice, cancelKeyboard(lang));
      return;
    }

    if (step === 'ad_price') {
      ctx.session.adData.price = text;
      ctx.session.step = 'ad_description';
      await ctx.reply(T.specialistAdDescription, cancelKeyboard(lang));
      return;
    }

    if (step === 'ad_description') {
      ctx.session.adData.description = text;
      ctx.session.step = 'ad_contact';
      const prompt = ctx.session.adType === 'client' ? T.clientAdContact : T.specialistAdContact;
      await ctx.reply(prompt, cancelKeyboard(lang));
      return;
    }

    if (step === 'ad_contact') {
      ctx.session.adData.contact = text;
      const u = ctx.from!;
      const d = ctx.session.adData;
      const firstName = u.first_name || '';

      let adText = '';
      if (ctx.session.adType === 'specialist') {
        adText = `👨‍⚖️ <b>MUTAXASSIS ELONI</b>\n⚖️ Soha: ${d.field}\n📍 Hudud: ${d.region}\n📅 Tajriba: ${d.experience}\n💰 Narx: ${d.price}\n📝 Ma'lumot: ${d.description}\n📞 Aloqa: ${d.contact}\n👤 Telegram: <a href="tg://user?id=${u.id}">${firstName}</a>`;
      } else {
        adText = `👤 <b>MUROJAATCHI ELONI</b>\n📌 Soha: ${d.field}\n📍 Hudud: ${d.region}\n📝 Muammo: ${d.description}\n📞 Aloqa: ${d.contact}\n👤 Telegram: <a href="tg://user?id=${u.id}">${firstName}</a>`;
      }

      try {
        const groupMsg = await bot.telegram.sendMessage(ADS_GROUP_ID, adText, { parse_mode: 'HTML' });
        await pool.query(
          `INSERT INTO ads (telegram_id, ad_type, field, region, experience, price, description, contact, message_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [String(u.id), ctx.session.adType, d.field, d.region, d.experience || null, d.price || null, d.description, d.contact, groupMsg.message_id]
        );
      } catch (e) {
        console.error('Ads group error:', e);
      }

      const doneMsg = ctx.session.adType === 'client' ? T.clientAdPosted : T.specialistAdPosted;
      ctx.session.step = 'main_menu';
      ctx.session.adData = {};
      ctx.session.adType = null;
      await ctx.reply(doneMsg, mainMenuKeyboard(lang));
      return;
    }

    // ─── AI CHAT ───────────────────────────────────────────────────────────
    if (step === 'ai_chat') {
      const waitMsg = await ctx.reply(T.aiTyping);
      try {
        const answer = await askGemini(text, lang);
        await bot.telegram.deleteMessage(ctx.chat!.id, waitMsg.message_id);
        const chunks = splitLongMessage(answer);
        for (const chunk of chunks) {
          await ctx.reply(chunk);
        }
      } catch {
        await bot.telegram.deleteMessage(ctx.chat!.id, waitMsg.message_id);
        await ctx.reply(T.aiError);
      }
      await ctx.reply(T.selectSection, cancelKeyboard(lang));
      return;
    }

    // ─── LEGAL CONSULT ─────────────────────────────────────────────────────
    if (step === 'legal_consult_desc') {
      const u = ctx.from!;
      const serviceText = `⚖️ <b>HUQUQIY TUSHUNTIRISH SO'ROVI</b>\n\n👤 <a href="tg://user?id=${u.id}">${u.first_name || ''}</a>\n🆔 ID: ${u.id}\n@${u.username || '-'}\n\n📝 Muammo:\n${text}`;
      try {
        const groupMsg = await bot.telegram.sendMessage(SERVICE_GROUP_ID, serviceText, { parse_mode: 'HTML' });
        await pool.query(
          `INSERT INTO service_requests (telegram_id, first_name, service_type, description, message_id) VALUES ($1,$2,$3,$4,$5)`,
          [String(u.id), u.first_name || null, 'legal_consult', text, groupMsg.message_id]
        );
      } catch (e) {
        console.error('Service group error:', e);
      }
      ctx.session.step = 'main_menu';
      await ctx.reply(T.legalConsultSent, mainMenuKeyboard(lang));
      return;
    }

    // ─── DOC CREATE ────────────────────────────────────────────────────────
    if (step === 'doc_create_desc') {
      const u = ctx.from!;
      const serviceText = `✍️ <b>HUJJAT TUZIB BERISH SO'ROVI</b>\n\n👤 <a href="tg://user?id=${u.id}">${u.first_name || ''}</a>\n🆔 ID: ${u.id}\n@${u.username || '-'}\n\n📄 Kerakli hujjat:\n${text}`;
      try {
        const groupMsg = await bot.telegram.sendMessage(SERVICE_GROUP_ID, serviceText, { parse_mode: 'HTML' });
        await pool.query(
          `INSERT INTO service_requests (telegram_id, first_name, service_type, description, message_id) VALUES ($1,$2,$3,$4,$5)`,
          [String(u.id), u.first_name || null, 'doc_create', text, groupMsg.message_id]
        );
      } catch (e) {
        console.error('Service group error:', e);
      }
      ctx.session.step = 'main_menu';
      await ctx.reply(T.docCreateSent, mainMenuKeyboard(lang));
      return;
    }

    // ─── ADMIN MESSAGE ─────────────────────────────────────────────────────
    if (step === 'admin_msg') {
      const u = ctx.from!;
      const adminText = `📨 <b>Foydalanuvchidan xabar</b>\n👤 ${u.first_name || ''} ${(u as any).last_name || ''} (@${u.username || '-'})\n🆔 ID: ${u.id}\n💬 Xabar: ${text}`;
      const adminId = process.env.ADMIN_TELEGRAM_ID;
      if (adminId) {
        try { await bot.telegram.sendMessage(parseInt(adminId), adminText, { parse_mode: 'HTML' }); } catch {}
      }
      try { await bot.telegram.sendMessage(SERVICE_GROUP_ID, adminText, { parse_mode: 'HTML' }); } catch {}
      ctx.session.step = 'main_menu';
      await ctx.reply(T.adminSent, mainMenuKeyboard(lang));
      return;
    }

    // ─── PAYMENT SCREENSHOT ────────────────────────────────────────────────
    if (step === 'awaiting_payment_screenshot' && msg.photo) {
      const u = ctx.from!;
      const docCode = ctx.session.pendingDocCode;
      const photo = msg.photo[msg.photo.length - 1];
      const caption = `💳 <b>TO'LOV SCREENSHOTI</b>\n👤 <a href="tg://user?id=${u.id}">${u.first_name || ''}</a>\n🆔 ID: ${u.id}\n📄 Hujjat kodi: ${docCode}`;
      try {
        await bot.telegram.sendPhoto(PAYMENT_GROUP_ID, photo.file_id, { caption, parse_mode: 'HTML' });
        await pool.query(
          `INSERT INTO payment_screenshots (telegram_id, document_code, file_id) VALUES ($1,$2,$3)`,
          [String(u.id), docCode, photo.file_id]
        );
      } catch (e) {
        console.error('Payment group error:', e);
      }

      // Send the document
      const docRes = await pool.query(`SELECT * FROM legal_documents WHERE code = $1`, [docCode]);
      const doc = docRes.rows[0];
      if (doc) {
        await ctx.reply(T.docPaymentReceived);
        try { await ctx.replyWithDocument(doc.file_id); } catch {}
      }
      ctx.session.step = 'main_menu';
      ctx.session.pendingDocCode = undefined;
      await ctx.reply(T.selectSection, mainMenuKeyboard(lang));
      return;
    }

    // ─── ADMIN: BROADCAST ──────────────────────────────────────────────────
    if (step === 'admin_broadcast' && isAdmin(ctx)) {
      const usersRes = await pool.query(`SELECT telegram_id FROM bot_users`);
      let count = 0;
      for (const row of usersRes.rows) {
        try {
          await bot.telegram.sendMessage(parseInt(row.telegram_id), text, { parse_mode: 'HTML' });
          count++;
        } catch {}
      }
      ctx.session.step = 'admin_panel';
      await ctx.reply(T.adminBroadcastDone(count), adminPanelKeyboard(lang));
      return;
    }

    // ─── ADMIN: DOC UPLOAD ─────────────────────────────────────────────────
    if (step === 'admin_doc_file' && isAdmin(ctx)) {
      let fileId: string | null = null;
      let fileType = 'document';
      if (msg.document) { fileId = msg.document.file_id; fileType = 'document'; }
      else if (msg.photo) { fileId = msg.photo[msg.photo.length - 1].file_id; fileType = 'photo'; }
      if (!fileId) {
        await ctx.reply('❌ Fayl yoki rasm yuboring.');
        return;
      }
      ctx.session.adminDocFlow = { ...ctx.session.adminDocFlow, fileId, fileType };
      ctx.session.step = 'admin_doc_name_uz';
      await ctx.reply(T.adminAddDocName, cancelKeyboard(lang));
      return;
    }

    if (step === 'admin_doc_name_uz' && isAdmin(ctx)) {
      ctx.session.adminDocFlow = { ...ctx.session.adminDocFlow, nameUz: text };
      ctx.session.step = 'admin_doc_name_ru';
      await ctx.reply(T.adminAddDocNameRu, cancelKeyboard(lang));
      return;
    }

    if (step === 'admin_doc_name_ru' && isAdmin(ctx)) {
      ctx.session.adminDocFlow = { ...ctx.session.adminDocFlow, nameRu: text };
      ctx.session.step = 'admin_doc_name_en';
      await ctx.reply(T.adminAddDocNameEn, cancelKeyboard(lang));
      return;
    }

    if (step === 'admin_doc_name_en' && isAdmin(ctx)) {
      ctx.session.adminDocFlow = { ...ctx.session.adminDocFlow, nameEn: text };
      ctx.session.step = 'admin_doc_code';
      await ctx.reply(T.adminAddDocCode, cancelKeyboard(lang));
      return;
    }

    if (step === 'admin_doc_code' && isAdmin(ctx)) {
      const codeRegex = /^[A-Z]{2}\d{3}$/;
      if (!codeRegex.test(text)) {
        await ctx.reply('❌ Noto\'g\'ri format. Masalan: HA001 (2 bosh harf + 3 raqam)');
        return;
      }
      ctx.session.adminDocFlow = { ...ctx.session.adminDocFlow, code: text };
      ctx.session.step = 'admin_doc_price';
      await ctx.reply(T.adminAddDocPrice, cancelKeyboard(lang));
      return;
    }

    if (step === 'admin_doc_price' && isAdmin(ctx)) {
      const price = parseFloat(text);
      if (isNaN(price)) {
        await ctx.reply('❌ Faqat raqam kiriting (masalan: 0 yoki 50000)');
        return;
      }
      const flow = ctx.session.adminDocFlow!;
      const isPaid = price > 0;

      try {
        await pool.query(
          `INSERT INTO legal_documents (title_uz, title_ru, title_en, file_id, file_type, category, doc_type, code, price, is_paid) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [flow.nameUz, flow.nameRu, flow.nameEn, flow.fileId, flow.fileType || 'document', flow.category, flow.docType || 'sample', flow.code, price, isPaid]
        );

        // Send to docs group
        const docGroupText = `📄 <b>YANGI HUJJAT QO'SHILDI</b>\n\n📛 Nomi (UZ): ${flow.nameUz}\n📛 Nomi (RU): ${flow.nameRu}\n📛 Nomi (EN): ${flow.nameEn}\n📂 Tur: ${flow.docType}\n🗂️ Kategoriya: ${flow.category}\n🔑 Kod: <code>${flow.code}</code>\n💰 Narx: ${isPaid ? price.toLocaleString() + ' so\'m ⭐' : 'Bepul ✅'}`;
        try {
          await bot.telegram.sendMessage(DOCS_GROUP_ID, docGroupText, { parse_mode: 'HTML' });
          if (flow.fileId) {
            if (flow.fileType === 'photo') await bot.telegram.sendPhoto(DOCS_GROUP_ID, flow.fileId);
            else await bot.telegram.sendDocument(DOCS_GROUP_ID, flow.fileId);
          }
        } catch {}

        ctx.session.adminDocFlow = undefined;
        ctx.session.step = 'admin_panel';
        await ctx.reply(T.adminDocAdded, adminPanelKeyboard(lang));
      } catch (e: any) {
        if (e.message?.includes('unique')) {
          await ctx.reply('❌ Bu kod allaqachon mavjud. Boshqa kod kiriting.');
          ctx.session.step = 'admin_doc_code';
        } else {
          await ctx.reply('❌ Xatolik: ' + e.message);
        }
      }
      return;
    }

    // ─── ADMIN: CARD ───────────────────────────────────────────────────────
    if (step === 'admin_card_owner' && isAdmin(ctx)) {
      ctx.session.cardFlow = { ownerName: text };
      ctx.session.step = 'admin_card_number';
      await ctx.reply(T.adminCardNumber, cancelKeyboard(lang));
      return;
    }

    if (step === 'admin_card_number' && isAdmin(ctx)) {
      const ownerName = ctx.session.cardFlow?.ownerName || '';
      await pool.query(`INSERT INTO payment_cards (owner_name, card_number) VALUES ($1,$2)`, [ownerName, text]);
      ctx.session.step = 'admin_panel';
      ctx.session.cardFlow = undefined;
      await ctx.reply(T.adminCardAdded, adminPanelKeyboard(lang));
      return;
    }

    if (step === 'admin_card_remove' && isAdmin(ctx)) {
      const cardId = parseInt(text);
      if (!isNaN(cardId)) {
        await pool.query(`UPDATE payment_cards SET is_active = false WHERE id = $1`, [cardId]);
        await ctx.reply(T.adminCardRemoved, adminPanelKeyboard(lang));
      } else {
        await ctx.reply('❌ Noto\'g\'ri ID');
      }
      ctx.session.step = 'admin_panel';
      return;
    }

    // ─── DEFAULT: back to menu ─────────────────────────────────────────────
    if (ctx.session.step === 'main_menu' || !ctx.session.step) {
      await ctx.reply(T.selectSection, mainMenuKeyboard(lang));
    }
  });

  // ── Error handler ──
  bot.catch((err, ctx) => {
    console.error(`Bot error for ${ctx.updateType}:`, err);
    try {
      ctx.reply('❌ Xatolik yuz berdi. Iltimos qayta urinib ko\'ring.').catch(() => {});
    } catch {}
  });
}
