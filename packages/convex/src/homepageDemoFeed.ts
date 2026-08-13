import type { SupportedLocale } from "./i18n";
import { SUPPORTED_LOCALES } from "./i18n";
import type { Milestone } from "./types";

export const HOMEPAGE_DEMO_PHOTO_KEYS = ["bump", "bag", "labor", "hospital", "born"] as const;

export type HomepageDemoPhotoKey = (typeof HOMEPAGE_DEMO_PHOTO_KEYS)[number];

export const HOMEPAGE_DEMO_PHOTO_FILES: Record<HomepageDemoPhotoKey, string> = {
  bump: "bump.jpg",
  bag: "bag.jpg",
  labor: "labor.jpg",
  hospital: "hospital.jpg",
  born: "born.jpg",
};

/** Due date is two days before "now" — slightly overdue when labour starts. */
export const HOMEPAGE_DEMO_DUE_DATE_MINUTES_AGO = 48 * 60;

export type HomepageDemoFeedSlot =
  | {
      kind: "update";
      minutesAgo: number;
      milestone?: Milestone;
      photo?: HomepageDemoPhotoKey;
    }
  | {
      kind: "encouragement";
      minutesAgo: number;
    };

export type HomepageDemoFeedItem =
  | {
      kind: "update";
      minutesAgo: number;
      message: string;
      milestone?: Milestone;
      photo?: HomepageDemoPhotoKey;
    }
  | {
      kind: "encouragement";
      minutesAgo: number;
      authorName: string;
      message: string;
    };

export type HomepageDemoEncouragementCopy = {
  authorName: string;
  message: string;
};

export type HomepageDemoLocaleCopy = {
  updates: readonly string[];
  encouragements: readonly HomepageDemoEncouragementCopy[];
};

/**
 * Shared timeline shape for every locale demo baby. Copy is filled in from
 * `HOMEPAGE_DEMO_FEED_COPY` so photos, milestones, and timing stay aligned.
 */
export const HOMEPAGE_DEMO_FEED_SLOTS = [
  { kind: "update", minutesAgo: 48 * 60, photo: "bump" },
  { kind: "encouragement", minutesAgo: 46 * 60 },
  { kind: "encouragement", minutesAgo: 44 * 60 },
  { kind: "update", minutesAgo: 41 * 60, milestone: "labor_started" },
  { kind: "encouragement", minutesAgo: 40 * 60 },
  { kind: "encouragement", minutesAgo: 38 * 60 },
  { kind: "update", minutesAgo: 33 * 60, photo: "bag" },
  { kind: "encouragement", minutesAgo: 32 * 60 },
  { kind: "update", minutesAgo: 26 * 60, photo: "labor" },
  { kind: "encouragement", minutesAgo: 25 * 60 },
  { kind: "update", minutesAgo: 20 * 60, milestone: "gone_to_hospital" },
  { kind: "encouragement", minutesAgo: 19 * 60 },
  { kind: "encouragement", minutesAgo: 18 * 60 },
  { kind: "update", minutesAgo: 14 * 60, photo: "hospital" },
  { kind: "encouragement", minutesAgo: 13 * 60 },
  { kind: "update", minutesAgo: 8 * 60 },
  { kind: "encouragement", minutesAgo: 7 * 60 },
  { kind: "encouragement", minutesAgo: 4 * 60 },
  { kind: "update", minutesAgo: 150, milestone: "born", photo: "born" },
  { kind: "encouragement", minutesAgo: 120 },
  { kind: "encouragement", minutesAgo: 90 },
  { kind: "encouragement", minutesAgo: 45 },
  { kind: "encouragement", minutesAgo: 20 },
] as const satisfies ReadonlyArray<HomepageDemoFeedSlot>;

export const HOMEPAGE_DEMO_FEED_COPY: Record<SupportedLocale, HomepageDemoLocaleCopy> = {
  "en-GB": {
    updates: [
      "40 weeks and this bump is out of control. Restless night — wondering if tonight's the night.",
      "Okay this is it!! Contractions every 7 minutes. Timing them on the app and trying to stay calm.",
      "Contractions are 4–5 minutes apart and a lot stronger. Bag is by the door. Midwife said we can stay home a little longer.",
      "Long night on the ball. Slow, wave-by-wave labour. Thank you for every message — they really help 💛",
      "Heading in! Contractions are intense and close together. Time to meet our girl.",
      "Checked in and settled. Lights are low, epidural is working. Waiting for her to make her way. Everyone here has been so kind.",
      "8cm!! Getting close. Partner has been a rock. We can feel her coming.",
      "She's here!! Juniper Mae Hale, 7lb 2oz, born after a long beautiful labour. We are smitten. Thank you for walking these two days with us.",
    ],
    encouragements: [
      { authorName: "Grandma Helen", message: "Rest up, sweetheart. Can't wait to meet her! 💕" },
      {
        authorName: "Sam",
        message: "The nesting is REAL. Sending you the biggest hug. You've got this.",
      },
      { authorName: "Maya", message: "YOU'VE GOT THIS. Phone is glued to my hand. Love you both." },
      { authorName: "Uncle Mateo", message: "One wave at a time. So proud of you two." },
      { authorName: "Jess", message: "Thinking of you!! Keep us posted when you can." },
      {
        authorName: "Priya",
        message: "You're doing amazing. We've got the dog if you need anything at all!",
      },
      {
        authorName: "Grandma Helen",
        message: "Drive safe. I'll be thinking of you the whole way.",
      },
      { authorName: "Aunt Leah", message: "Yessss go go go!! Love you." },
      { authorName: "Sam", message: "The calm in the middle. So proud of you. Breathe." },
      { authorName: "Maya", message: "AAAAAAAA I'm pacing. Come on Juniper, you've got this!!" },
      { authorName: "Uncle Mateo", message: "Almost there. Sending all the strength." },
      {
        authorName: "Grandma Helen",
        message: "WELCOME JUNIPER MAE HALE 💕💕💕 Grandma is crying happy tears.",
      },
      {
        authorName: "Sam",
        message: "JUNIPER!!!! She's here she's here she's here. Look at that little face.",
      },
      {
        authorName: "Priya",
        message: "Congratulations you two. What a journey. Rest now — we'll bring food.",
      },
      { authorName: "Jess", message: "Welcome to the world, Juniper. What wonderful news." },
    ],
  },
  "en-US": {
    updates: [
      "40 weeks and this bump is out of control. Restless night — wondering if tonight's the night.",
      "Okay this is it!! Contractions every 7 minutes. Timing them on the app and trying to stay calm.",
      "Contractions are 4–5 minutes apart and a lot stronger. Bag is by the door. Midwife said we can stay home a little longer.",
      "Long night on the ball. Slow, wave-by-wave labor. Thank you for every message — they really help 💛",
      "Heading in! Contractions are intense and close together. Time to meet our girl.",
      "Checked in and settled. Lights are low, epidural is working. Waiting for her to make her way. Everyone here has been so kind.",
      "8cm!! Getting close. Partner has been a rock. We can feel her coming.",
      "She's here!! Willow Jane Brooks, 7lb 2oz, born after a long beautiful labor. We are smitten. Thank you for walking these two days with us.",
    ],
    encouragements: [
      { authorName: "Grandma Linda", message: "Rest up, sweetheart. Can't wait to meet her! 💕" },
      {
        authorName: "Casey",
        message: "The nesting is REAL. Sending you the biggest hug. You've got this.",
      },
      { authorName: "Maya", message: "YOU'VE GOT THIS. Phone is glued to my hand. Love you both." },
      { authorName: "Uncle Mateo", message: "One wave at a time. So proud of you two." },
      { authorName: "Jess", message: "Thinking of you!! Keep us posted when you can." },
      {
        authorName: "Priya",
        message: "You're doing amazing. We've got the dog if you need anything at all!",
      },
      {
        authorName: "Grandma Linda",
        message: "Drive safe. I'll be thinking of you the whole way.",
      },
      { authorName: "Aunt Leah", message: "Yessss go go go!! Love you." },
      { authorName: "Casey", message: "The calm in the middle. So proud of you. Breathe." },
      { authorName: "Maya", message: "AAAAAAAA I'm pacing. Come on Willow, you've got this!!" },
      { authorName: "Uncle Mateo", message: "Almost there. Sending all the strength." },
      {
        authorName: "Grandma Linda",
        message: "WELCOME WILLOW JANE BROOKS 💕💕💕 Grandma is crying happy tears.",
      },
      {
        authorName: "Casey",
        message: "WILLOW!!!! She's here she's here she's here. Look at that little face.",
      },
      {
        authorName: "Priya",
        message: "Congratulations you two. What a journey. Rest now — we'll bring food.",
      },
      { authorName: "Jess", message: "Welcome to the world, Willow. What wonderful news." },
    ],
  },
  sv: {
    updates: [
      "Vecka 40 och magen är enorm. Rastlös natt — kanske är det i natt?",
      "Nu är det dags!! Värkar var sjunde minut. Vi tar tiden i appen och försöker hålla oss lugna.",
      "Värkarna kommer var 4–5:e minut och är mycket starkare. Väskan står vid dörren. Barnmorskan sa att vi kan stanna hemma en stund till.",
      "Lång natt på bollen. Långsam förlossning, en värk i taget. Tack för varje meddelande — de hjälper verkligen 💛",
      "Vi åker in! Värkarna är intensiva och täta. Dags att träffa vår tjej.",
      "Inskrivna och landade. Dämpat ljus, epiduralen fungerar. Vi väntar in henne. Alla här är så snälla.",
      "8 cm!! Det är nära. Partnern har varit en klippa. Vi känner att hon är på väg.",
      "Hon är här!! Ella Linnea Holm, 3240 g, född efter en lång vacker förlossning. Vi är helt sålda. Tack för att ni gick de här två dygnen med oss.",
    ],
    encouragements: [
      {
        authorName: "Mormor Ingrid",
        message: "Vila nu, älskling. Längtar så efter att träffa henne! 💕",
      },
      {
        authorName: "Kim",
        message: "Redet är PÅ RIKTIGT. Skickar den största kramen. Ni klarar det här.",
      },
      { authorName: "Maja", message: "NI KLARAR DET. Telefonen sitter i handen. Älskar er båda." },
      { authorName: "Farbror Erik", message: "En värk i taget. Så stolt över er." },
      { authorName: "Lisa", message: "Tänker på er!! Hör av er när ni kan." },
      { authorName: "Sara", message: "Du är fantastisk. Vi tar hunden om ni behöver något alls!" },
      { authorName: "Mormor Ingrid", message: "Kör försiktigt. Jag tänker på er hela vägen." },
      { authorName: "Faster Anna", message: "Jaaaa kör kör kör!! Älskar er." },
      { authorName: "Kim", message: "Lugnet mitt i allt. Så stolt över dig. Andas." },
      { authorName: "Maja", message: "AAAAAAAA jag går av och an. Kom igen Ella, du klarar det!!" },
      { authorName: "Farbror Erik", message: "Nästan framme. Skickar all styrka." },
      {
        authorName: "Mormor Ingrid",
        message: "VÄLKOMMEN ELLA LINNEA HOLM 💕💕💕 Mormor gråter glädjetårar.",
      },
      {
        authorName: "Kim",
        message: "ELLA!!!! Hon är här hon är här hon är här. Titta på den lilla kinden.",
      },
      { authorName: "Sara", message: "Grattis ni två. Vilken resa. Vila nu — vi kommer med mat." },
      { authorName: "Lisa", message: "Välkommen till världen, Ella. Vilken underbar nyhet." },
    ],
  },
  es: {
    updates: [
      "40 semanas y esta barriga no cabe en ninguna parte. Noche inquieta — ¿será esta la noche?",
      "¡¡Ya está!! Contracciones cada 7 minutos. Las cronometramos en la app e intentamos mantener la calma.",
      "Las contracciones vienen cada 4–5 minutos y son mucho más fuertes. La bolsa está en la puerta. La matrona dijo que podemos quedarnos un rato más en casa.",
      "Noche larga en la pelota. Parto lento, oleada a oleada. Gracias por cada mensaje — de verdad ayudan 💛",
      "¡Nos vamos! Contracciones intensas y seguidas. Hora de conocer a nuestra niña.",
      "Ya estamos ingresadas. Luces bajas, la epidural funciona. Esperamos a que ella se abra camino. Aquí todo el mundo ha sido un amor.",
      "¡¡8 cm!! Ya casi. Mi pareja ha sido un roca. La sentimos venir.",
      "¡¡Ya está aquí!! Lucía Mar Navarro, 3,240 g, nació después de un parto largo y hermoso. Estamos rendidos de amor. Gracias por acompañarnos estos dos días.",
    ],
    encouragements: [
      { authorName: "Abuela Carmen", message: "Descansa, mi vida. ¡Qué ganas de conocerla! 💕" },
      { authorName: "Sofía", message: "El nido es DE VERDAD. Un abrazo enorme. Vosotras podéis." },
      {
        authorName: "Camila",
        message: "VOSOTRAS PODÉIS. El teléfono no se me cae de la mano. Os quiero.",
      },
      { authorName: "Tío Mateo", message: "Una oleada cada vez. Qué orgulloso estoy de vosotras." },
      { authorName: "Laura", message: "¡Pensando en vosotras!! Escribid cuando podáis." },
      {
        authorName: "Valentina",
        message: "Lo estás haciendo increíble. ¡Nosotros tenemos al perro si hace falta!",
      },
      {
        authorName: "Abuela Carmen",
        message: "Conducid con cuidado. Voy a estar pensando en vosotras todo el camino.",
      },
      { authorName: "Tía Elena", message: "¡¡Siiiiii vamos vamos vamos!! Os quiero." },
      { authorName: "Sofía", message: "La calma en medio de todo. Qué orgullosa estoy. Respira." },
      {
        authorName: "Camila",
        message: "AAAAAAAA estoy de un lado a otro. ¡Ánimo Lucía, tú puedes!!",
      },
      { authorName: "Tío Mateo", message: "Casi está. Os mando toda la fuerza." },
      {
        authorName: "Abuela Carmen",
        message: "BIENVENIDA LUCÍA MAR NAVARRO 💕💕💕 La abuela llora de alegría.",
      },
      { authorName: "Sofía", message: "¡¡¡LUCÍA!!! Ya está ya está ya está. Mira esa carita." },
      {
        authorName: "Valentina",
        message: "Enhorabuena a las dos. Qué viaje. Descansad — llevamos comida.",
      },
      { authorName: "Laura", message: "Bienvenida al mundo, Lucía. Qué noticia tan maravillosa." },
    ],
  },
  "pt-BR": {
    updates: [
      "40 semanas e essa barriga não cabe em lugar nenhum. Noite agitada — será que é hoje?",
      "É agora!! Contrações a cada 7 minutos. Estamos cronometrando no app e tentando ficar calmas.",
      "As contrações vêm a cada 4–5 minutos e estão bem mais fortes. A mala está na porta. A parteira disse que ainda podemos ficar um pouco em casa.",
      "Noite longa na bola. Parto devagar, uma onda de cada vez. Obrigada por cada mensagem — elas ajudam de verdade 💛",
      "Estamos indo! Contrações intensas e bem seguidas. Hora de conhecer a nossa menina.",
      "Já fomos internadas. Luz baixa, a epidural está funcionando. Esperando ela fazer o caminho. Todo mundo aqui tem sido um amor.",
      "8 cm!! Está perto. O parceiro tem sido uma rocha. A gente sente ela chegando.",
      "Ela chegou!! Helena Luz Costa, 3.240 g, nascida depois de um parto longo e lindo. Estamos apaixonadas. Obrigada por caminhar esses dois dias com a gente.",
    ],
    encouragements: [
      {
        authorName: "Vovó Ana",
        message: "Descansa, meu amor. Mal posso esperar para conhecê-la! 💕",
      },
      {
        authorName: "Mari",
        message: "O ninho está REAL. Mandando o maior abraço. Vocês vão conseguir.",
      },
      {
        authorName: "Beatriz",
        message: "VOCÊS CONSEGUEM. O celular não sai da minha mão. Amo vocês duas.",
      },
      { authorName: "Tio Pedro", message: "Uma onda de cada vez. Tão orgulhoso de vocês." },
      { authorName: "Júlia", message: "Pensando em vocês!! Mandem notícia quando puderem." },
      {
        authorName: "Fernanda",
        message: "Você está incrível. A gente fica com o cachorro se precisar de qualquer coisa!",
      },
      {
        authorName: "Vovó Ana",
        message: "Dirijam com cuidado. Vou estar pensando em vocês o caminho todo.",
      },
      { authorName: "Tia Luiza", message: "Siiiiim vão vão vão!! Amo vocês." },
      { authorName: "Mari", message: "A calma no meio de tudo. Tão orgulhosa de você. Respira." },
      {
        authorName: "Beatriz",
        message: "AAAAAAAA estou andando de um lado para o outro. Vai Helena, você consegue!!",
      },
      { authorName: "Tio Pedro", message: "Quase lá. Mandando toda a força." },
      {
        authorName: "Vovó Ana",
        message: "BEM-VINDA HELENA LUZ COSTA 💕💕💕 A vovó está chorando de alegria.",
      },
      {
        authorName: "Mari",
        message: "HELENA!!!! Ela chegou ela chegou ela chegou. Olha essa carinha.",
      },
      {
        authorName: "Fernanda",
        message: "Parabéns para vocês duas. Que jornada. Descansem — a gente leva comida.",
      },
      { authorName: "Júlia", message: "Bem-vinda ao mundo, Helena. Que notícia maravilhosa." },
    ],
  },
};

function updateSlotCount() {
  return HOMEPAGE_DEMO_FEED_SLOTS.filter((slot) => slot.kind === "update").length;
}

function encouragementSlotCount() {
  return HOMEPAGE_DEMO_FEED_SLOTS.filter((slot) => slot.kind === "encouragement").length;
}

export function homepageDemoFeedFor(locale: SupportedLocale): HomepageDemoFeedItem[] {
  const copy = HOMEPAGE_DEMO_FEED_COPY[locale];
  if (copy.updates.length !== updateSlotCount()) {
    throw new Error(`${locale} homepage demo is missing update copy`);
  }
  if (copy.encouragements.length !== encouragementSlotCount()) {
    throw new Error(`${locale} homepage demo is missing encouragement copy`);
  }

  let updateIndex = 0;
  let encouragementIndex = 0;
  return HOMEPAGE_DEMO_FEED_SLOTS.map((slot): HomepageDemoFeedItem => {
    if (slot.kind === "update") {
      const message = copy.updates[updateIndex];
      updateIndex += 1;
      if (!message) throw new Error(`${locale} homepage demo is missing update copy`);
      return {
        kind: "update",
        minutesAgo: slot.minutesAgo,
        message,
        milestone: slot.milestone,
        photo: slot.photo,
      };
    }
    const encouragement = copy.encouragements[encouragementIndex];
    encouragementIndex += 1;
    if (!encouragement) throw new Error(`${locale} homepage demo is missing encouragement copy`);
    return {
      kind: "encouragement",
      minutesAgo: slot.minutesAgo,
      authorName: encouragement.authorName,
      message: encouragement.message,
    };
  });
}

/** @deprecated Prefer `homepageDemoFeedFor(locale)` — kept as the en-GB fixture. */
export const HOMEPAGE_DEMO_FEED = homepageDemoFeedFor("en-GB");

export function homepageDemoLocales(): SupportedLocale[] {
  return [...SUPPORTED_LOCALES];
}
