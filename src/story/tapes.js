// أشرطة الجدة (قسم 2 و17): كل ليلة بتلاقي شريط أو اثنين ما سمعتهم قبل. كل شريط بيكشف قطعة من القصة
// ونصيحة بتنكتب بدفتر الجدة. lines = اللي بتسمعه باللعبة، note = اللي بينكتب بالدفتر.
export const TAPES = [
  {
    id: 'voices',
    title: { ar: 'شريط ١: الأصوات', en: 'Tape 1: Voices' },
    lines: [
      ['إذا سمعت حدا بنادي عليك بالليل بصوت بتعرفه… لا تردّ.', "If someone calls you at night in a voice you know… don't answer."],
      ['هي بتعرف أصواتنا كلها. حتى صوتك إنت.', 'She knows all our voices. Even yours.'],
    ],
    note: { ar: 'الصوت المألوف من غرفة مظلمة = كمين. لا تلحقه.', en: 'A familiar voice from a dark room is a trap. Do not follow it.' },
  },
  {
    id: 'salt',
    title: { ar: 'شريط ٢: الملح', en: 'Tape 2: Salt' },
    lines: [
      ['الملح يا حبيبي. خط ملح عالعتبة، وما بتقطعه.', "Salt, dear. A line of salt on the threshold, and she won't cross it."],
      ['بس الملح بيذوب مع الوقت… لا تتّكل عليه كثير.', "But salt melts with time… don't rely on it too long."],
    ],
    note: { ar: 'الملح عند باب بيوقفها شوي، وبعدين بيذوب.', en: 'Salt at a doorway stops her for a while, then melts.' },
  },
  {
    id: 'anklet',
    title: { ar: 'شريط ٣: الخلخال', en: 'Tape 3: The anklet' },
    lines: [
      ['خلخالها… أخذته منها سنة الثلجة. طول ما هو عندي، هي محبوسة بهالبيت.', 'Her anklet… I took it the year of the great snow. As long as I keep it, she is bound to this house.'],
      ['ويمكن لو رجّعتلها إيّاه لعشّها تحت… بتهدى. ما بعرف. ما جرّبت.', "Maybe if it went back to her nest below… she'd calm. I don't know. I never tried."],
    ],
    note: { ar: 'الخلخال إلها. عشّها بالقبو. (شو بيصير لو رجّعته؟)', en: "The anklet is hers. Her nest is in the cellar. (What if you gave it back?)" },
  },
  {
    id: 'dawn',
    title: { ar: 'شريط ٤: الديك', en: 'Tape 4: The rooster' },
    lines: [
      ['صياح الديك بيحرقها. إذا وصلت للفجر، بتنسحب للبير.', 'The rooster’s cry burns her. Reach dawn, and she withdraws to the well.'],
      ['وقرب الفجر بتعمى شوي… بس بتصير مجنونة.', 'Near dawn she goes half blind… but she goes mad.'],
    ],
    note: { ar: 'آخر ساعة قبل الفجر بتشوف أقل، بس بتهجم أكثر.', en: 'In the last hour before dawn she sees less but attacks more.' },
  },
  {
    id: 'habits',
    title: { ar: 'شريط ٥: بتتعلّم', en: 'Tape 5: She learns' },
    lines: [
      ['بتتعلّم يا ابني. إذا تخبّيت بنفس المطرح مرتين، الثالثة بتستناك فيه.', 'She learns, son. Hide in the same place twice, and the third time she waits there.'],
      ['وإذا ضلّيت ترمي نفس الحيلة، بتصير تضحك عليها.', 'Keep using the same trick and she starts laughing at it.'],
    ],
    note: { ar: 'غيّر مخبأك وطريقك كل ليلة. الأجراس والراديو بيفقدوا تأثيرهم.', en: 'Change your hiding place and route each night. Bells and the radio lose their effect.' },
  },
  {
    id: 'children',
    title: { ar: 'شريط ٦: الولاد', en: 'Tape 6: The children' },
    lines: [
      ['الولاد اللي راحوا… ما راحوا. هي خبّتهم تحت، بالقبو.', "The children who vanished… they didn't leave. She hid them below, in the cellar."],
      ['سامعهم بيغنّوا معها؟ لا تغنّي معهم.', "Can you hear them singing with her? Don't sing along."],
    ],
    note: { ar: 'التهويدة يعني هي بتتجوّل، مش عم تصيد. لما تسكت… انتبه.', en: 'The lullaby means she is wandering, not hunting. When it stops… beware.' },
  },
  {
    id: 'keeper',
    title: { ar: 'شريط ٧: الحارسة', en: 'Tape 7: The keeper' },
    lines: [
      ['أنا ما كنت أحبسها لحالي… كنت أحرسها. والقرية كلها نايمة ومش عارفة.', 'I was not just keeping her… I was guarding her. And the whole village sleeps, unaware.'],
      ['إذا رجّعت الغراض الخمسة للبير، الحراسة بتصير إلك. سامحني يا حبيبي.', 'If you return the five things to the well, the watch becomes yours. Forgive me, dear.'],
    ],
    note: { ar: 'الطقس الكامل + كل الأشرطة = الحقيقة كاملة.', en: 'The full ritual + every tape = the whole truth.' },
  },
];

// جمل الجدة بالتلفون (الأخيرة كذبة: هي اللي بتحكي بصوت الجدة)
export const PHONE_LINES = [
  ['حبيبي… لا تطلع من مخبأك لما تسكت الغنّية.', "Dear… don't leave your hiding place when the singing stops."],
  ['الملح عالعتبة يا ابني… الملح.', 'Salt on the threshold, son… salt.'],
  ['ستّك هون… لا تخاف… تعال لعندي عالقبو.', "Grandma's here… don't be afraid… come to me in the cellar."],
];

// الأشرطة اللي لسا ما انسمعت، بالترتيب (القصة بتنكشف بالتدريج)
export function tapesForNight(found, n = 2) {
  return TAPES.filter((t) => !found.includes(t.id)).slice(0, n);
}
