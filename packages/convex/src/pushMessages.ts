import type { NotifiableStatus } from "./types";
import type { SupportedLocale } from "./i18n";

type PushCopy = {
  title: (babyName: string) => string;
  body: string;
};

const copy: Record<SupportedLocale, Record<NotifiableStatus, PushCopy>> = {
  "en-GB": {
    labor_started: {
      title: (name) => `${name} – Labour has started!`,
      body: "Labour has begun. Check for updates!",
    },
    gone_to_hospital: {
      title: (name) => `${name} is on the way to hospital!`,
      body: "They're heading to hospital. Check for updates!",
    },
    born: {
      title: (name) => `${name} is here! 🎉`,
      body: "The baby has arrived! Check for updates!",
    },
    photo_added: {
      title: (name) => `${name} – New photo! 📸`,
      body: "A new photo has been added. Take a look!",
    },
  },
  "en-US": {
    labor_started: {
      title: (name) => `${name} – Labor has started!`,
      body: "Labor has begun. Check for updates!",
    },
    gone_to_hospital: {
      title: (name) => `${name} is on the way to the hospital!`,
      body: "They're heading to the hospital. Check for updates!",
    },
    born: {
      title: (name) => `${name} is here! 🎉`,
      body: "The baby has arrived! Check for updates!",
    },
    photo_added: {
      title: (name) => `${name} – New photo! 📸`,
      body: "A new photo has been added. Check it out!",
    },
  },
  sv: {
    labor_started: {
      title: (name) => `${name} – Förlossningen har börjat!`,
      body: "Förlossningen har börjat. Se de senaste uppdateringarna!",
    },
    gone_to_hospital: {
      title: (name) => `${name} är på väg till sjukhuset!`,
      body: "De är på väg till sjukhuset. Se de senaste uppdateringarna!",
    },
    born: {
      title: (name) => `${name} är här! 🎉`,
      body: "Bebisen har kommit! Se de senaste uppdateringarna!",
    },
    photo_added: {
      title: (name) => `${name} – Nytt foto! 📸`,
      body: "Ett nytt foto har lagts till. Ta en titt!",
    },
  },
  es: {
    labor_started: {
      title: (name) => `${name} – ¡Comenzó el parto!`,
      body: "El parto ha comenzado. ¡Mira las novedades!",
    },
    gone_to_hospital: {
      title: (name) => `¡${name} va camino al hospital!`,
      body: "Van camino al hospital. ¡Mira las novedades!",
    },
    born: {
      title: (name) => `¡${name} ya está aquí! 🎉`,
      body: "¡El bebé ha llegado! Mira las novedades.",
    },
    photo_added: {
      title: (name) => `${name} – ¡Nueva foto! 📸`,
      body: "Se ha añadido una foto nueva. ¡Échale un vistazo!",
    },
  },
  "pt-BR": {
    labor_started: {
      title: (name) => `${name} – O trabalho de parto começou!`,
      body: "O trabalho de parto começou. Confira as novidades!",
    },
    gone_to_hospital: {
      title: (name) => `${name} está a caminho do hospital!`,
      body: "A família está indo para o hospital. Confira as novidades!",
    },
    born: {
      title: (name) => `${name} chegou! 🎉`,
      body: "O bebê nasceu! Confira as novidades!",
    },
    photo_added: {
      title: (name) => `${name} – Foto nova! 📸`,
      body: "Uma foto nova foi adicionada. Venha conferir!",
    },
  },
};

export function getPushMessage(
  locale: SupportedLocale,
  status: NotifiableStatus,
  babyName: string,
) {
  const message = copy[locale][status];
  return { title: message.title(babyName), body: message.body };
}
