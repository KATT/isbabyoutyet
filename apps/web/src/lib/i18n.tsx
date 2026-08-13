import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { getLocale } from "@/paraglide/runtime";
import {
  DEFAULT_LOCALE,
  resolveSupportedLocale,
  type SupportedLocale,
} from "@workspace/convex/src/i18n";

type Variables = Record<string, number | string>;

const enGB = {
  "Track the progress of labour and birth – know when baby arrives!":
    "Track the progress of labour and birth – know when baby arrives!",
  "Is Baby Out Yet? – Share Your Baby's Arrival": "Is Baby Out Yet? – Share Your Baby's Arrival",
  "Stop answering 'any news yet?' texts. Create a simple page to keep everyone updated, let them send encouragement, and notify them the moment baby arrives.":
    "Stop answering 'any news yet?' texts. Create a simple page to keep everyone updated, let them send encouragement, and notify them the moment baby arrives.",
  "Free forever, no ads": "Free forever, no ads",
  'Stop answering "any news yet?" texts. Share one link and let everyone follow along.':
    'Stop answering "any news yet?" texts. Share one link and let everyone follow along.',
  "Go to Dashboard": "Go to Dashboard",
  "Get Started": "Get Started",
  "Is {{name}} out yet?": "Is {{name}} out yet?",
  "{{count}} day overdue – Is {{name}} out yet?": "{{count}} day overdue – Is {{name}} out yet?",
  "{{count}} days overdue – Is {{name}} out yet?": "{{count}} days overdue – Is {{name}} out yet?",
  "{{count}} day until due date – Is {{name}} out yet?":
    "{{count}} day until due date – Is {{name}} out yet?",
  "{{count}} days until due date – Is {{name}} out yet?":
    "{{count}} days until due date – Is {{name}} out yet?",
  "{{title}} – Track Your Baby's Journey": "{{title}} – Track Your Baby's Journey",
  "Track {{name}}'s journey – know when baby arrives!":
    "Track {{name}}'s journey – know when baby arrives!",
  "Not yet": "Not yet",
  "Baby is still on the way": "Baby is still on the way",
  "{{count}} day overdue": "{{count}} day overdue",
  "{{count}} days overdue": "{{count}} days overdue",
  "{{count}} day until due date": "{{count}} day until due date",
  "{{count}} days until due date": "{{count}} days until due date",
  "Due date: {{date}}": "Due date: {{date}}",
  "Labour started": "Labour started",
  "Not gone to hospital yet": "Not gone to hospital yet",
  "Started at {{date}} ({{relative}})": "Started at {{date}} ({{relative}})",
  "Gone to hospital": "Gone to hospital",
  "Yes! Baby is out": "Yes! Baby is out",
  "Born on {{date}} ({{relative}})": "Born on {{date}} ({{relative}})",
  "Baby born": "Baby born",
  "Latest from the family": "Latest from the family",
  "Updated {{relative}}": "Updated {{relative}}",
  "Having a baby? Are people messaging you non-stop? Create your own page →":
    "Having a baby? Are people messaging you non-stop? Create your own page →",
  "Post update": "Post update",
  Settings: "Settings",
  "Close settings": "Close settings",
  "Copy link to share": "Copy link to share",
  "Copied!": "Copied!",
  "Copied to clipboard": "Copied to clipboard",
  "Owner actions": "Owner actions",
  "Page actions": "Page actions",
  "Baby Name": "Baby Name",
  "Due Date": "Due Date",
  Theme: "Theme",
  Encouragements: "Encouragements",
  "Visitors can send messages": "Visitors can send messages",
  "Form disabled": "Form disabled",
  Language: "Language",
  "Use my profile language ({{language}})": "Use my profile language ({{language}})",
  "All visitors see this page in {{language}}.": "All visitors see this page in {{language}}.",
  Default: "Default",
  Edit: "Edit",
  Change: "Change",
  Save: "Save",
  Cancel: "Cancel",
  "Send Encouragement": "Send Encouragement",
  "Leave a message of support for {{name}}'s family":
    "Leave a message of support for {{name}}'s family",
  "Your name": "Your name",
  Message: "Message",
  "Write your message of encouragement...": "Write your message of encouragement...",
  "Sending...": "Sending...",
  "Sending your encouragement...": "Sending your encouragement...",
  "Your kind words have been sent! 💕": "Your kind words have been sent! 💕",
  "Updates & encouragements": "Updates & encouragements",
  "Loading the timeline...": "Loading the timeline...",
  "Nothing here yet": "Nothing here yet",
  "Post your first update to keep everyone in the loop!":
    "Post your first update to keep everyone in the loop!",
  "Updates from the family will show up here.": "Updates from the family will show up here.",
  "{{name}}'s family": "{{name}}'s family",
  "New photo": "New photo",
  Update: "Update",
  "Page photo": "Page photo",
  "Get Notifications": "Get Notifications",
  Unsubscribe: "Unsubscribe",
  "Get notified when the baby's status changes": "Get notified when the baby's status changes",
  "Stop receiving push notifications for updates": "Stop receiving push notifications for updates",
  "Your Babies": "Your Babies",
  "Track and manage all your babies' journeys": "Track and manage all your babies' journeys",
  "Add Baby": "Add Baby",
  Logout: "Log out",
  "No babies added yet": "No babies added yet",
  "Get started by adding your first baby to track their journey":
    "Get started by adding your first baby to track their journey",
  "Add Your First Baby": "Add Your First Baby",
  "Due today!": "Due today!",
  "Profile language": "Profile language",
  "This is initially chosen from your browser. New baby pages inherit it.":
    "This is initially chosen from your browser. New baby pages inherit it.",
  "Request another language": "Request another language",
  "Tell us which language you would like us to add.":
    "Tell us which language you would like us to add.",
  "Language name or code": "Language name or code",
  "Send request": "Send request",
  "Language request saved": "Language request saved",
  "Back to Dashboard": "Back to Dashboard",
  "Add a Baby": "Add a Baby",
  "Track the progress of labour and birth": "Track the progress of labour and birth",
  "Baby Information": "Baby Information",
  "Enter your baby's name and due date to get started":
    "Enter your baby's name and due date to get started",
  "Enter baby's name": "Enter baby's name",
  "Creating...": "Creating...",
  "Sign In": "Sign In",
  "Sign in to track your babies": "Sign in to track your babies",
  Email: "Email",
  Password: "Password",
  "Signing in...": "Signing in...",
  "Don't have an account?": "Don't have an account?",
  "Sign up": "Sign up",
  "Sign Up": "Sign Up",
  "Create an account to start tracking": "Create an account to start tracking",
  Name: "Name",
  "Signing up...": "Signing up...",
  "Already have an account?": "Already have an account?",
  "Sign in": "Sign in",
  "Page Not Found": "Page Not Found",
  "Looks like this page hasn't arrived yet. Let's get you back home!":
    "Looks like this page hasn't arrived yet. Let's get you back home!",
  "Go Home": "Go Home",
} as const;

type TranslationKey = keyof typeof enGB;

const sv: Partial<Record<TranslationKey, string>> = {
  "Track the progress of labour and birth – know when baby arrives!":
    "Följ förlossningen och få veta när bebisen har kommit!",
  "Is Baby Out Yet? – Share Your Baby's Arrival": "Har bebisen kommit? – Dela bebisens ankomst",
  "Stop answering 'any news yet?' texts. Create a simple page to keep everyone updated, let them send encouragement, and notify them the moment baby arrives.":
    "Slipp svara på alla meddelanden om nyheter. Skapa en enkel sida som håller alla uppdaterade.",
  "Free forever, no ads": "Alltid gratis, utan reklam",
  'Stop answering "any news yet?" texts. Share one link and let everyone follow along.':
    'Slipp svara på "några nyheter?". Dela en länk så kan alla följa med.',
  "Go to Dashboard": "Gå till översikten",
  "Get Started": "Kom igång",
  "Is {{name}} out yet?": "Har {{name}} kommit?",
  "{{count}} day overdue – Is {{name}} out yet?": "{{count}} dag över tiden – Har {{name}} kommit?",
  "{{count}} days overdue – Is {{name}} out yet?":
    "{{count}} dagar över tiden – Har {{name}} kommit?",
  "{{count}} day until due date – Is {{name}} out yet?":
    "{{count}} dag till beräknad födsel – Har {{name}} kommit?",
  "{{count}} days until due date – Is {{name}} out yet?":
    "{{count}} dagar till beräknad födsel – Har {{name}} kommit?",
  "{{title}} – Track Your Baby's Journey": "{{title}} – Följ bebisens resa",
  "Track {{name}}'s journey – know when baby arrives!":
    "Följ {{name}}s resa och få veta när bebisen har kommit!",
  "Not yet": "Inte än",
  "Baby is still on the way": "Bebisen är fortfarande på väg",
  "{{count}} day overdue": "{{count}} dag över tiden",
  "{{count}} days overdue": "{{count}} dagar över tiden",
  "{{count}} day until due date": "{{count}} dag till beräknad födsel",
  "{{count}} days until due date": "{{count}} dagar till beräknad födsel",
  "Due date: {{date}}": "Beräknad födsel: {{date}}",
  "Labour started": "Förlossningen har börjat",
  "Not gone to hospital yet": "Inte åkt till sjukhuset än",
  "Started at {{date}} ({{relative}})": "Började {{date}} ({{relative}})",
  "Gone to hospital": "Åkt till sjukhuset",
  "Yes! Baby is out": "Ja! Bebisen har kommit",
  "Born on {{date}} ({{relative}})": "Född {{date}} ({{relative}})",
  "Baby born": "Bebisen är född",
  "Latest from the family": "Senaste nytt från familjen",
  "Updated {{relative}}": "Uppdaterat {{relative}}",
  "Having a baby? Are people messaging you non-stop? Create your own page →":
    "Väntar du barn? Skapa din egen sida →",
  "Post update": "Lägg uppdatering",
  Settings: "Inställningar",
  "Close settings": "Stäng inställningar",
  "Copy link to share": "Kopiera delningslänk",
  "Copied!": "Kopierad!",
  "Copied to clipboard": "Kopierad till urklipp",
  "Owner actions": "Ägaråtgärder",
  "Page actions": "Sidåtgärder",
  "Baby Name": "Bebisens namn",
  "Due Date": "Beräknat datum",
  Theme: "Tema",
  Encouragements: "Hälsningar",
  "Visitors can send messages": "Besökare kan skicka meddelanden",
  "Form disabled": "Formuläret är avstängt",
  Language: "Språk",
  "Use my profile language ({{language}})": "Använd mitt profilspråk ({{language}})",
  "All visitors see this page in {{language}}.": "Alla besökare ser sidan på {{language}}.",
  Default: "Standard",
  Edit: "Redigera",
  Change: "Ändra",
  Save: "Spara",
  Cancel: "Avbryt",
  "Send Encouragement": "Skicka en hälsning",
  "Leave a message of support for {{name}}'s family": "Lämna en hälsning till {{name}}s familj",
  "Your name": "Ditt namn",
  Message: "Meddelande",
  "Write your message of encouragement...": "Skriv din hälsning...",
  "Sending...": "Skickar...",
  "Sending your encouragement...": "Skickar din hälsning...",
  "Your kind words have been sent! 💕": "Din fina hälsning har skickats! 💕",
  "Updates & encouragements": "Uppdateringar och hälsningar",
  "Loading the timeline...": "Laddar tidslinjen...",
  "Nothing here yet": "Inget här än",
  "Post your first update to keep everyone in the loop!":
    "Lägg upp din första uppdatering så att alla kan följa med!",
  "Updates from the family will show up here.": "Familjens uppdateringar visas här.",
  "{{name}}'s family": "{{name}}s familj",
  "New photo": "Nytt foto",
  Update: "Uppdatering",
  "Page photo": "Sidfoto",
  "Get Notifications": "Få notiser",
  Unsubscribe: "Avsluta notiser",
  "Get notified when the baby's status changes": "Få en notis när bebisens status ändras",
  "Stop receiving push notifications for updates": "Sluta få pushnotiser om uppdateringar",
  "Your Babies": "Dina bebisar",
  "Track and manage all your babies' journeys": "Följ och hantera dina bebisars resor",
  "Add Baby": "Lägg till bebis",
  Logout: "Logga ut",
  "No babies added yet": "Inga bebisar har lagts till än",
  "Get started by adding your first baby to track their journey":
    "Kom igång genom att lägga till din första bebis",
  "Add Your First Baby": "Lägg till din första bebis",
  "Due today!": "Beräknad idag!",
  "Profile language": "Profilspråk",
  "This is initially chosen from your browser. New baby pages inherit it.":
    "Språket väljs först från din webbläsare. Nya bebissidor ärver det.",
  "Request another language": "Önska ett annat språk",
  "Tell us which language you would like us to add.": "Berätta vilket språk du vill att vi lägger till.",
  "Language name or code": "Språknamn eller kod",
  "Send request": "Skicka önskemål",
  "Language request saved": "Språkönskemålet har sparats",
  "Back to Dashboard": "Tillbaka till översikten",
  "Add a Baby": "Lägg till en bebis",
  "Track the progress of labour and birth": "Följ förlossningen",
  "Baby Information": "Information om bebisen",
  "Enter your baby's name and due date to get started":
    "Ange bebisens namn och beräknade födelsedatum",
  "Enter baby's name": "Ange bebisens namn",
  "Creating...": "Skapar...",
  "Sign In": "Logga in",
  "Sign in to track your babies": "Logga in för att följa dina bebisar",
  Email: "E-post",
  Password: "Lösenord",
  "Signing in...": "Loggar in...",
  "Don't have an account?": "Har du inget konto?",
  "Sign up": "Registrera dig",
  "Sign Up": "Registrera dig",
  "Create an account to start tracking": "Skapa ett konto för att börja följa",
  Name: "Namn",
  "Signing up...": "Registrerar...",
  "Already have an account?": "Har du redan ett konto?",
  "Sign in": "Logga in",
  "Page Not Found": "Sidan hittades inte",
  "Looks like this page hasn't arrived yet. Let's get you back home!":
    "Den här sidan verkar inte ha kommit än. Vi tar dig tillbaka hem!",
  "Go Home": "Gå hem",
};

const es: Partial<Record<TranslationKey, string>> = {
  "Track the progress of labour and birth – know when baby arrives!":
    "Sigue el progreso del parto y entérate cuando nazca el bebé.",
  "Is Baby Out Yet? – Share Your Baby's Arrival": "¿Ya nació el bebé? – Comparte su llegada",
  "Stop answering 'any news yet?' texts. Create a simple page to keep everyone updated, let them send encouragement, and notify them the moment baby arrives.":
    "Deja de responder mensajes preguntando si hay novedades. Crea una página sencilla para mantener a todos informados.",
  "Free forever, no ads": "Gratis para siempre, sin anuncios",
  'Stop answering "any news yet?" texts. Share one link and let everyone follow along.':
    'Deja de responder "¿hay novedades?". Comparte un enlace para que todos puedan seguirlo.',
  "Go to Dashboard": "Ir al panel",
  "Get Started": "Empezar",
  "Is {{name}} out yet?": "¿Ya nació {{name}}?",
  "{{count}} day overdue – Is {{name}} out yet?":
    "{{count}} día de retraso – ¿Ya nació {{name}}?",
  "{{count}} days overdue – Is {{name}} out yet?":
    "{{count}} días de retraso – ¿Ya nació {{name}}?",
  "{{count}} day until due date – Is {{name}} out yet?":
    "{{count}} día para la fecha prevista – ¿Ya nació {{name}}?",
  "{{count}} days until due date – Is {{name}} out yet?":
    "{{count}} días para la fecha prevista – ¿Ya nació {{name}}?",
  "{{title}} – Track Your Baby's Journey": "{{title}} – Sigue el camino de tu bebé",
  "Track {{name}}'s journey – know when baby arrives!":
    "Sigue el camino de {{name}} y entérate cuando nazca.",
  "Not yet": "Todavía no",
  "Baby is still on the way": "El bebé sigue en camino",
  "{{count}} day overdue": "{{count}} día de retraso",
  "{{count}} days overdue": "{{count}} días de retraso",
  "{{count}} day until due date": "{{count}} día para la fecha prevista",
  "{{count}} days until due date": "{{count}} días para la fecha prevista",
  "Due date: {{date}}": "Fecha prevista: {{date}}",
  "Labour started": "Comenzó el parto",
  "Not gone to hospital yet": "Aún no han ido al hospital",
  "Started at {{date}} ({{relative}})": "Comenzó el {{date}} ({{relative}})",
  "Gone to hospital": "Camino al hospital",
  "Yes! Baby is out": "¡Sí! El bebé ya nació",
  "Born on {{date}} ({{relative}})": "Nació el {{date}} ({{relative}})",
  "Baby born": "Bebé nacido",
  "Latest from the family": "Últimas noticias de la familia",
  "Updated {{relative}}": "Actualizado {{relative}}",
  "Having a baby? Are people messaging you non-stop? Create your own page →":
    "¿Esperas un bebé? Crea tu propia página →",
  "Post update": "Publicar novedad",
  Settings: "Configuración",
  "Close settings": "Cerrar configuración",
  "Copy link to share": "Copiar enlace para compartir",
  "Copied!": "¡Copiado!",
  "Copied to clipboard": "Copiado al portapapeles",
  "Owner actions": "Acciones del propietario",
  "Page actions": "Acciones de la página",
  "Baby Name": "Nombre del bebé",
  "Due Date": "Fecha prevista",
  Theme: "Tema",
  Encouragements: "Mensajes de ánimo",
  "Visitors can send messages": "Los visitantes pueden enviar mensajes",
  "Form disabled": "Formulario desactivado",
  Language: "Idioma",
  "Use my profile language ({{language}})": "Usar el idioma de mi perfil ({{language}})",
  "All visitors see this page in {{language}}.": "Todos los visitantes ven esta página en {{language}}.",
  Default: "Predeterminado",
  Edit: "Editar",
  Change: "Cambiar",
  Save: "Guardar",
  Cancel: "Cancelar",
  "Send Encouragement": "Enviar ánimo",
  "Leave a message of support for {{name}}'s family":
    "Deja un mensaje de apoyo para la familia de {{name}}",
  "Your name": "Tu nombre",
  Message: "Mensaje",
  "Write your message of encouragement...": "Escribe tu mensaje de ánimo...",
  "Sending...": "Enviando...",
  "Sending your encouragement...": "Enviando tu mensaje...",
  "Your kind words have been sent! 💕": "¡Tus palabras se han enviado! 💕",
  "Updates & encouragements": "Novedades y mensajes de ánimo",
  "Loading the timeline...": "Cargando la cronología...",
  "Nothing here yet": "Aún no hay nada",
  "Post your first update to keep everyone in the loop!":
    "¡Publica tu primera novedad para mantener a todos informados!",
  "Updates from the family will show up here.": "Las novedades de la familia aparecerán aquí.",
  "{{name}}'s family": "Familia de {{name}}",
  "New photo": "Foto nueva",
  Update: "Novedad",
  "Page photo": "Foto de la página",
  "Get Notifications": "Recibir notificaciones",
  Unsubscribe: "Cancelar suscripción",
  "Get notified when the baby's status changes": "Recibe una notificación cuando cambie el estado",
  "Stop receiving push notifications for updates": "Dejar de recibir notificaciones",
  "Your Babies": "Tus bebés",
  "Track and manage all your babies' journeys": "Sigue y gestiona el camino de tus bebés",
  "Add Baby": "Añadir bebé",
  Logout: "Cerrar sesión",
  "No babies added yet": "Aún no has añadido bebés",
  "Get started by adding your first baby to track their journey":
    "Empieza añadiendo tu primer bebé",
  "Add Your First Baby": "Añade tu primer bebé",
  "Due today!": "¡Fecha prevista hoy!",
  "Profile language": "Idioma del perfil",
  "This is initially chosen from your browser. New baby pages inherit it.":
    "Se elige inicialmente según tu navegador. Las páginas nuevas lo heredan.",
  "Request another language": "Solicitar otro idioma",
  "Tell us which language you would like us to add.": "Dinos qué idioma quieres que añadamos.",
  "Language name or code": "Nombre o código del idioma",
  "Send request": "Enviar solicitud",
  "Language request saved": "Solicitud de idioma guardada",
  "Back to Dashboard": "Volver al panel",
  "Add a Baby": "Añadir un bebé",
  "Track the progress of labour and birth": "Sigue el progreso del parto",
  "Baby Information": "Información del bebé",
  "Enter your baby's name and due date to get started":
    "Introduce el nombre y la fecha prevista del bebé",
  "Enter baby's name": "Introduce el nombre del bebé",
  "Creating...": "Creando...",
  "Sign In": "Iniciar sesión",
  "Sign in to track your babies": "Inicia sesión para seguir a tus bebés",
  Email: "Correo electrónico",
  Password: "Contraseña",
  "Signing in...": "Iniciando sesión...",
  "Don't have an account?": "¿No tienes una cuenta?",
  "Sign up": "Regístrate",
  "Sign Up": "Registrarse",
  "Create an account to start tracking": "Crea una cuenta para empezar",
  Name: "Nombre",
  "Signing up...": "Registrando...",
  "Already have an account?": "¿Ya tienes una cuenta?",
  "Sign in": "Inicia sesión",
  "Page Not Found": "Página no encontrada",
  "Looks like this page hasn't arrived yet. Let's get you back home!":
    "Parece que esta página aún no ha llegado. Volvamos al inicio.",
  "Go Home": "Ir al inicio",
};

const enUS: Partial<Record<TranslationKey, string>> = {
  "Track the progress of labour and birth – know when baby arrives!":
    "Track the progress of labor and birth – know when baby arrives!",
  "Labour started": "Labor started",
  "Track the progress of labour and birth": "Track the progress of labor and birth",
};

const translations: Record<SupportedLocale, Partial<Record<TranslationKey, string>>> = {
  "en-GB": enGB,
  "en-US": enUS,
  sv,
  es,
};

const LocaleContext = createContext<SupportedLocale>(DEFAULT_LOCALE);

export function LocaleProvider(props: { locale: SupportedLocale; children: ReactNode }) {
  return <LocaleContext value={props.locale}>{props.children}</LocaleContext>;
}

export function getDetectedLocale() {
  return resolveSupportedLocale(getLocale());
}

export function translate(
  locale: SupportedLocale,
  key: TranslationKey,
  variables: Variables = {},
) {
  let message: string = translations[locale][key] ?? enGB[key];
  for (const [name, value] of Object.entries(variables)) {
    message = message.replaceAll(`{{${name}}}`, String(value));
  }
  return message;
}

export function useI18n() {
  const locale = useContext(LocaleContext);
  return useMemo(
    () => ({
      locale,
      t: (key: TranslationKey, variables?: Variables) => translate(locale, key, variables),
    }),
    [locale],
  );
}

export function getLanguageName(locale: SupportedLocale, displayLocale: SupportedLocale = locale) {
  return new Intl.DisplayNames([displayLocale], { type: "language" }).of(locale) ?? locale;
}
