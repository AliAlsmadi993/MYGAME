// تفاعل الجمهور (قسم 22): منقرأ شات تويتش (قراءة بس، دخول مجهول بدون حساب)،
// والجمهور بيصوّت كل VOTE_SECONDS على حدث. كل مشاهد إله صوت واحد بكل جولة تصويت.
export const VOTE_SECONDS = 40;

export const ACTIONS = {
  light: { ar: 'اطفي الكشاف', cmd: '!ضو' },
  sing: { ar: 'خلّيها تغني', cmd: '!غني' },
  door: { ar: 'سكّر باب', cmd: '!باب' },
  scare: { ar: 'خوّفه', cmd: '!خوف' },
};

const COMMANDS = {
  '!ضو': 'light',
  '!light': 'light',
  '!غني': 'sing',
  '!sing': 'sing',
  '!باب': 'door',
  '!door': 'door',
  '!خوف': 'scare',
  '!scare': 'scare',
};

export function commandOf(text) {
  return COMMANDS[text.trim().split(/\s+/)[0]?.toLowerCase()] ?? null;
}

// سطر IRC من تويتش ← { user, text } أو null
export function parseIrc(line) {
  const m = /^(?:@\S+ )?:(\w+)!\S+ PRIVMSG #\S+ :(.*)$/.exec(line.trim());
  return m ? { user: m[1].toLowerCase(), text: m[2] } : null;
}

export class Vote {
  constructor() {
    this.votes = new Map(); // مشاهد ← حدث
  }

  add(user, text) {
    const a = commandOf(text);
    if (a) this.votes.set(user, a);
    return a;
  }

  tally() {
    const t = Object.fromEntries(Object.keys(ACTIONS).map((k) => [k, 0]));
    for (const a of this.votes.values()) t[a]++;
    return t;
  }

  // الأكثر أصوات (التعادل: أول واحد بالترتيب) وبيبلّش جولة جديدة
  close() {
    const t = this.tally();
    const best = Object.entries(t).sort((a, b) => b[1] - a[1])[0];
    this.votes.clear();
    return best && best[1] > 0 ? best[0] : null;
  }
}

export class TwitchChat {
  constructor(channel, onMessage) {
    this.channel = channel.toLowerCase().replace(/^#/, '').trim();
    this.onMessage = onMessage;
    this.ws = null;
    this.fake = null;
  }

  connect() {
    // قناة "test": تصويت وهمي لتجرّب الميزة بدون بث
    if (this.channel === 'test') {
      const users = ['sara', 'omar', 'lina', 'yazan', 'huda', 'kareem'];
      const cmds = Object.values(ACTIONS).map((a) => a.cmd);
      this.fake = setInterval(() => this.onMessage(users[Math.floor(Math.random() * users.length)], cmds[Math.floor(Math.random() * cmds.length)]), 2500);
      return;
    }
    const ws = (this.ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443'));
    ws.onopen = () => {
      ws.send('PASS SCHMOOPIIE');
      ws.send(`NICK justinfan${Math.floor(10000 + Math.random() * 80000)}`);
      ws.send(`JOIN #${this.channel}`);
    };
    ws.onmessage = (e) => {
      for (const line of String(e.data).split('\r\n')) {
        if (line.startsWith('PING')) ws.send(line.replace('PING', 'PONG'));
        const msg = parseIrc(line);
        if (msg) this.onMessage(msg.user, msg.text);
      }
    };
  }

  close() {
    clearInterval(this.fake);
    this.ws?.close();
  }
}
