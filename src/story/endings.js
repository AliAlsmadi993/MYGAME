// النهايات (قسم 18)
import { TAPES } from './tapes.js';

export const ENDINGS = {
  escape: {
    title: 'نجوت… هالمرة',
    lines: ['طلعت من البوابة. وراك، سمعتها بتبكي جوّا البير… والبيت سكت.', 'You left through the gate. Behind you, she wept inside the well… and the house went silent.'],
    taunt: '«رح ترجع… كلهم بيرجعوا»',
  },
  dawn: {
    title: 'صاح الديك',
    lines: ['صاح الديك وانسحبت للبير. طلعت… وبالطريق رنّ تلفونك. صوتك إنت قال: «ارجع».', 'The rooster crowed and she withdrew. On the road your phone rang. Your own voice said: "Come back."'],
    taunt: '«بكرة بالليل… بستناك»',
  },
  true: {
    title: 'الحارس الجديد',
    lines: ['فهمت أخيراً: ستّك ما كانت تحبسها… كانت تحرس القرية منها. سكّرت البوابة من جوّا، وقعدت عالبير. الليلة الجاية، الدور عليك.', 'You finally understand: grandma was not imprisoning her… she was guarding the village. You lock the gate from inside and sit by the well. Tomorrow night, the watch is yours.'],
    taunt: '«أهلين يا حارس… نلعب كل ليلة؟»',
  },
  secret: {
    title: 'رجّعتلها خلخالها',
    lines: ['هي ما كانت بدها تأذيك… كانت بدها خلخالها. بس لما طلعت من البوابة، سمعت خطوات حافية وراك. رنّة خلخال. طلعت معك.', 'She never wanted to hurt you… she wanted her anklet. But as you left through the gate, you heard bare footsteps behind you. The jingle of an anklet. She came with you.'],
    taunt: '«وين بيتك؟… بيتك بيتي»',
  },
  demo: {
    title: 'نهاية النسخة التجريبية',
    lines: ['الساعة ثنتين… والليلة لسا طويلة. بالنسخة الكاملة: خمس ساعات لحد الفجر، أربع نهايات، ليلة ثانية، السطح والطابق الفوقاني… وهي لسا ما خلّصت معك.', "It's 2 AM… and the night is still long. The full game: five hours until dawn, four endings, a second night, the roof and the upper floor… and she isn't done with you."],
    taunt: '«ارجع… بستناك بالنسخة الكاملة»',
  },
  death: {
    title: 'مسكتك',
    lines: null,
    taunt: '«رح ترجع… كلهم بيرجعوا»',
  },
};

// result من اللعبة: death | dawn | escape
export function resolveEnding({ result, ankletReturned = false, tapesFound = [] }) {
  if (result !== 'escape') return result;
  if (ankletReturned) return 'secret';
  if (TAPES.every((t) => tapesFound.includes(t.id))) return 'true';
  return 'escape';
}
