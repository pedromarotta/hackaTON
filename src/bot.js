// src/bot.js
require('dotenv').config();
console.log('🟢 [bot.js] loaded, env vars:', {
  BOT_TOKEN: !!process.env.BOT_TOKEN,
  BASE_URL: !!process.env.BASE_URL
});

const { Telegraf, session } = require('telegraf');
const axios                 = require('axios');

if (!process.env.BOT_TOKEN || !process.env.BASE_URL) {
  console.error('⚠️ BOT_TOKEN and BASE_URL must be set');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session());

// /start handler: greets the user
bot.start((ctx) => {
    return ctx.reply(
      `🎉 Welcome to TON‑Hack! Here’s what you can do:\n` +
      `/pay     – Start a new TON deposit\n` +
      `/confirm – After you enter an amount, confirm to get your Mercado Pago link`
    );
  });
  
  // /help handler: repeats available commands
  bot.help((ctx) => {
    return ctx.reply(
      `🤖 Commands:\n` +
      `/start   – Show welcome message\n` +
      `/pay     – Enter ARS amount to deposit\n` +
      `/confirm – Generate your payment link`
    );
  });
  
// 2) /pay — ask for ARS amount
bot.command('pay', (ctx) => {
    ctx.session = { step: 'await_amount' };
    ctx.reply('💸 How many ARS would you like to deposit? Please send a number.');
  });
  
  // 3) on text — capture the amount
  bot.on('text', (ctx, next) => {
    if (ctx.session?.step === 'await_amount') {
      const n = parseFloat(ctx.message.text);
      if (isNaN(n) || n <= 0) {
        return ctx.reply('❗️ That doesn’t look like a valid positive number. Try again.');
      }
      ctx.session.amount = n;
      ctx.session.step   = 'await_confirm';
      return ctx.reply(
        `👍 Got it: *${n} ARS*.\n` +
        `When you’re ready, send /confirm to get your payment link.`,
        { parse_mode: 'Markdown' }
      );
    }
    return next();  // pass to other handlers
  });
  
  // 4) /confirm — call your REST endpoint
  bot.command('confirm', async (ctx) => {
    if (ctx.session?.step !== 'await_confirm') {
      return ctx.reply('❗️ Please start with /pay.');
    }
    const amount = ctx.session.amount;
  
    try {
      const { data } = await axios.post(
        `${process.env.BASE_URL}/create-payment`,
        { amount, description: `TON deposit for ${ctx.from.username || ctx.from.id}` }
      );
      await ctx.reply(`🔗 Here’s your link:\n${data.url}`);
      ctx.session = null;
    } catch (err) {
      console.error('Bot ▶️ create-payment error:', err.response?.data || err.message);
      await ctx.reply('❌ Failed to generate payment link. Please try again later.');
    }
  });
  
// Startup logic
(async () => {
  console.log('🔄 About to call bot.telegram.getMe()');
  try {
    const info = await bot.telegram.getMe();
    console.log('📡 getMe() succeeded:', info.username, `(id ${info.id})`);
  } catch (err) {
    console.error('❌ getMe() failed:', err.response?.body || err.message);
    process.exit(1);
  }

  console.log('🔄 Starting bot.launch()');
  bot.launch();  
  console.log('🤖 Bot started and listening for updates');
})();
