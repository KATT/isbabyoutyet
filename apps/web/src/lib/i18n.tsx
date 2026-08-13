import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { getLocale } from "@/paraglide/runtime";
import {
  DEFAULT_LOCALE,
  resolveSupportedLocale,
  type SupportedLocale,
} from "@workspace/convex/src/i18n";

/**
 * Paraglide owns request-safe locale detection and cookie persistence. This
 * catalog accepts an explicit locale because a public baby page can override
 * the visitor's cookie without changing that visitor's own preference.
 */
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
  "Photo of {{name}}": "Photo of {{name}}",
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
  "Violet Bloom": "Violet Bloom",
  "Twitter Blue": "Twitter Blue",
  Bubblegum: "Bubblegum",
  Catppuccin: "Catppuccin",
  "Mocha Mousse": "Mocha Mousse",
  "Quantum Rose": "Quantum Rose",
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
  "Photo added": "Photo added",
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
  "Add a message, a photo, or a milestone to post":
    "Add a message, a photo, or a milestone to post",
  "Pick a valid time — or leave it as now": "Pick a valid time — or leave it as now",
  "Please select an image file": "Please select an image file",
  "Photo must be 10 MB or smaller": "Photo must be 10 MB or smaller",
  "Failed to upload photo": "Failed to upload photo",
  "Update posted!": "Update posted!",
  "Post an update": "Post an update",
  "Everyone following {{name}}'s page will see it. A message, a photo, a milestone — each is optional, any mix works.":
    "Everyone following {{name}}'s page will see it. A message, a photo, a milestone — each is optional, any mix works.",
  "Write a message (optional)…": "Write a message (optional)…",
  "Update message (optional)": "Update message (optional)",
  "Photo to post": "Photo to post",
  "Remove photo": "Remove photo",
  "Status change (optional)": "Status change (optional)",
  "No status change": "No status change",
  'This changes the page status to "{{status}}" and notifies everyone subscribed.':
    'This changes the page status to "{{status}}" and notifies everyone subscribed.',
  "When did it happen?": "When did it happen?",
  "Defaults to now — set an earlier time if you're sharing the news after the fact.":
    "Defaults to now — set an earlier time if you're sharing the news after the fact.",
  "Change photo": "Change photo",
  "Add photo (optional)": "Add photo (optional)",
  "Posting...": "Posting...",
  'Post & mark "{{status}}"': 'Post & mark "{{status}}"',
  "Add a message, a photo, or a milestone — any one is enough.":
    "Add a message, a photo, or a milestone — any one is enough.",
  "Posted {{date}}": "Posted {{date}}",
  "Set as page photo": "Set as page photo",
  "Delete update": "Delete update",
  "Delete update?": "Delete update?",
  "This also unmarks the milestone on the status card.":
    "This also unmarks the milestone on the status card.",
  "This removes the update from the timeline.": "This removes the update from the timeline.",
  "If this photo is the current page photo, the previous one takes its place.":
    "If this photo is the current page photo, the previous one takes its place.",
  "This action cannot be undone.": "This action cannot be undone.",
  Delete: "Delete",
  "View photo full size": "View photo full size",
  "Baby update": "Baby update",
  "Close photo": "Close photo",
  "Message cannot be empty": "Message cannot be empty",
  "Edit your message": "Edit your message",
  "Saving...": "Saving...",
  "(you)": "(you)",
  "Edit encouragement": "Edit encouragement",
  "Delete encouragement": "Delete encouragement",
  "Delete Encouragement?": "Delete Encouragement?",
  "Are you sure you want to delete this encouragement from {{name}}? This action cannot be undone.":
    "Are you sure you want to delete this encouragement from {{name}}? This action cannot be undone.",
  "Update removed": "Update removed",
  "Failed to remove update": "Failed to remove update",
  "Set as the page photo": "Set as the page photo",
  "Failed to set page photo": "Failed to set page photo",
  "Encouragement removed": "Encouragement removed",
  "Failed to remove encouragement": "Failed to remove encouragement",
  "Encouragement updated": "Encouragement updated",
  "Failed to update encouragement": "Failed to update encouragement",
  "Notification sent!": "Notification sent!",
  "{{count}} person": "{{count}} person",
  "{{count}} people": "{{count}} people",
  "Notification cancelled": "Notification cancelled",
  "Failed to cancel notification": "Failed to cancel notification",
  "Sending notification...": "Sending notification...",
  "Push notifications are not supported in this browser.":
    "Push notifications are not supported in this browser.",
  "Notification permission denied": "Notification permission denied",
  "Notification permission is required": "Notification permission is required",
  "Failed to get subscription data": "Failed to get subscription data",
  "To receive notifications on iOS, add this page to your Home Screen first. Tap for instructions.":
    "To receive notifications on iOS, add this page to your Home Screen first. Tap for instructions.",
  "Get Notifications on iOS": "Get Notifications on iOS",
  "Install this app on your Home Screen before enabling push notifications on iOS.":
    "Install this app on your Home Screen before enabling push notifications on iOS.",
  "Tap the Share button in Safari": "Tap the Share button in Safari",
  'Scroll down and tap "Add to Home Screen"': 'Scroll down and tap "Add to Home Screen"',
  "Open the app from your Home Screen": "Open the app from your Home Screen",
  'Come back here and tap "Get Notifications"': 'Come back here and tap "Get Notifications"',
  "No subscription endpoint found": "No subscription endpoint found",
  "Unsubscribing from notifications...": "Unsubscribing from notifications...",
  "Unsubscribed from notifications!": "Unsubscribed from notifications!",
  "Failed to unsubscribe from notifications": "Failed to unsubscribe from notifications",
  "Subscribing to notifications...": "Subscribing to notifications...",
  "Subscribed to notifications!": "Subscribed to notifications!",
  "Failed to subscribe to notifications": "Failed to subscribe to notifications",
  "For You": "For You",
  "Everything you need to share the journey": "Everything you need to share the journey",
  "Update Your Status": "Update Your Status",
  "One tap updates everyone — labour started, at the hospital, baby's here. No group texts or repeated calls.":
    "One tap updates everyone — labour started, at the hospital, baby's here. No group texts or repeated calls.",
  "Countdown to Due Date": "Countdown to Due Date",
  "Set the due date so everyone can see how many days are left, including a friendly overdue counter.":
    "Set the due date so everyone can see how many days are left, including a friendly overdue counter.",
  "Make It Yours": "Make It Yours",
  "Choose a theme that matches your style — your page, your way.":
    "Choose a theme that matches your style — your page, your way.",
  "For Your Family & Friends": "For Your Family & Friends",
  "What everyone you share with gets": "What everyone you share with gets",
  "No Account Needed": "No Account Needed",
  "Anyone with the link can follow along without downloading an app or creating an account.":
    "Anyone with the link can follow along without downloading an app or creating an account.",
  "Visitors can leave messages of love and support in a digital guestbook.":
    "Visitors can leave messages of love and support in a digital guestbook.",
  "Get Notified": "Get Notified",
  "Subscribe to updates and hear the moment baby arrives without constantly refreshing.":
    "Subscribe to updates and hear the moment baby arrives without constantly refreshing.",
  "See It In Action": "See It In Action",
  "Open any stage to preview the baby page": "Open any stage to preview the baby page",
  Waiting: "Waiting",
  "Before labour starts": "Before labour starts",
  "Things are happening!": "Things are happening!",
  "At Hospital": "At Hospital",
  "Almost there!": "Almost there!",
  "Baby Born!": "Baby Born!",
  "Celebrate the arrival": "Celebrate the arrival",
  "How It Works": "How It Works",
  "Up and running in under a minute": "Up and running in under a minute",
  "Create Your Page": "Create Your Page",
  "Sign up and add your baby's name and due date. That's it.":
    "Sign up and add your baby's name and due date. That's it.",
  "Share the Link": "Share the Link",
  "Send it to family and friends. They can follow along and subscribe without an account.":
    "Send it to family and friends. They can follow along and subscribe without an account.",
  "Update as You Go": "Update as You Go",
  "Post each milestone once and everyone following gets the news.":
    "Post each milestone once and everyone following gets the news.",
  "Ready to share the journey?": "Ready to share the journey?",
  "Head back to your dashboard to keep everyone updated.":
    "Head back to your dashboard to keep everyone updated.",
  "Join families already sharing their special moments. It takes less than a minute.":
    "Join families already sharing their special moments. It takes less than a minute.",
  "Get Started Free": "Get Started Free",
  "Open source on GitHub": "Open source on GitHub",
  "Preview – {{title}}": "Preview – {{title}}",
  "Preview how your baby tracking page will look at different stages.":
    "Preview how your baby tracking page will look at different stages.",
  "Page Not Found": "Page Not Found",
  "Looks like this page hasn't arrived yet. Let's get you back home!":
    "Looks like this page hasn't arrived yet. Let's get you back home!",
  "Go Home": "Go Home",
} as const;

export type TranslationKey = keyof typeof enGB;

type PlaceholderNames<TKey extends string> =
  TKey extends `${string}{{${infer TName}}}${infer TRest}`
    ? TName | PlaceholderNames<TRest>
    : never;

type TranslationVariables<TKey extends TranslationKey> = {
  [TName in PlaceholderNames<TKey>]: number | string;
};

type TranslationArguments<TKey extends TranslationKey> =
  [PlaceholderNames<TKey>] extends [never]
    ? [variables?: never]
    : [variables: TranslationVariables<TKey>];

export type TranslationFunction = <TKey extends TranslationKey>(
  key: TKey,
  ...args: TranslationArguments<TKey>
) => string;

const sv: Record<TranslationKey, string> = {
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
  "Photo of {{name}}": "Foto på {{name}}",
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
  "Violet Bloom": "Violet Bloom",
  "Twitter Blue": "Twitter Blue",
  Bubblegum: "Bubblegum",
  Catppuccin: "Catppuccin",
  "Mocha Mousse": "Mocha Mousse",
  "Quantum Rose": "Quantum Rose",
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
  "Photo added": "Foto tillagt",
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
  "Tell us which language you would like us to add.":
    "Berätta vilket språk du vill att vi lägger till.",
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
  "Add a message, a photo, or a milestone to post":
    "Lägg till ett meddelande, ett foto eller en milstolpe",
  "Pick a valid time — or leave it as now": "Välj en giltig tid eller behåll tiden som nu",
  "Please select an image file": "Välj en bildfil",
  "Photo must be 10 MB or smaller": "Fotot får vara högst 10 MB",
  "Failed to upload photo": "Det gick inte att ladda upp fotot",
  "Update posted!": "Uppdateringen har publicerats!",
  "Post an update": "Publicera en uppdatering",
  "Everyone following {{name}}'s page will see it. A message, a photo, a milestone — each is optional, any mix works.":
    "Alla som följer {{name}}s sida ser den. Meddelande, foto och milstolpe är valfria och kan kombineras.",
  "Write a message (optional)…": "Skriv ett meddelande (valfritt)…",
  "Update message (optional)": "Uppdateringsmeddelande (valfritt)",
  "Photo to post": "Foto som ska publiceras",
  "Remove photo": "Ta bort foto",
  "Status change (optional)": "Statusändring (valfritt)",
  "No status change": "Ingen statusändring",
  'This changes the page status to "{{status}}" and notifies everyone subscribed.':
    'Det ändrar sidans status till "{{status}}" och meddelar alla prenumeranter.',
  "When did it happen?": "När hände det?",
  "Defaults to now — set an earlier time if you're sharing the news after the fact.":
    "Standard är nu. Välj en tidigare tid om du berättar i efterhand.",
  "Change photo": "Byt foto",
  "Add photo (optional)": "Lägg till foto (valfritt)",
  "Posting...": "Publicerar...",
  'Post & mark "{{status}}"': 'Publicera och markera "{{status}}"',
  "Add a message, a photo, or a milestone — any one is enough.":
    "Lägg till ett meddelande, ett foto eller en milstolpe.",
  "Posted {{date}}": "Publicerat {{date}}",
  "Set as page photo": "Använd som sidfoto",
  "Delete update": "Ta bort uppdatering",
  "Delete update?": "Ta bort uppdateringen?",
  "This also unmarks the milestone on the status card.":
    "Det tar också bort milstolpen från statuskortet.",
  "This removes the update from the timeline.": "Det tar bort uppdateringen från tidslinjen.",
  "If this photo is the current page photo, the previous one takes its place.":
    "Om detta är sidfotot återställs det föregående fotot.",
  "This action cannot be undone.": "Åtgärden kan inte ångras.",
  Delete: "Ta bort",
  "View photo full size": "Visa fotot i full storlek",
  "Baby update": "Bebisuppdatering",
  "Close photo": "Stäng foto",
  "Message cannot be empty": "Meddelandet får inte vara tomt",
  "Edit your message": "Redigera ditt meddelande",
  "Saving...": "Sparar...",
  "(you)": "(du)",
  "Edit encouragement": "Redigera hälsning",
  "Delete encouragement": "Ta bort hälsning",
  "Delete Encouragement?": "Ta bort hälsningen?",
  "Are you sure you want to delete this encouragement from {{name}}? This action cannot be undone.":
    "Vill du ta bort hälsningen från {{name}}? Åtgärden kan inte ångras.",
  "Update removed": "Uppdateringen har tagits bort",
  "Failed to remove update": "Det gick inte att ta bort uppdateringen",
  "Set as the page photo": "Används nu som sidfoto",
  "Failed to set page photo": "Det gick inte att byta sidfoto",
  "Encouragement removed": "Hälsningen har tagits bort",
  "Failed to remove encouragement": "Det gick inte att ta bort hälsningen",
  "Encouragement updated": "Hälsningen har uppdaterats",
  "Failed to update encouragement": "Det gick inte att uppdatera hälsningen",
  "Notification sent!": "Notisen har skickats!",
  "{{count}} person": "{{count}} person",
  "{{count}} people": "{{count}} personer",
  "Notification cancelled": "Notisen har avbrutits",
  "Failed to cancel notification": "Det gick inte att avbryta notisen",
  "Sending notification...": "Skickar notis...",
  "Push notifications are not supported in this browser.":
    "Pushnotiser stöds inte i den här webbläsaren.",
  "Notification permission denied": "Tillåtelse för notiser nekades",
  "Notification permission is required": "Tillåtelse för notiser krävs",
  "Failed to get subscription data": "Det gick inte att hämta prenumerationsuppgifter",
  "To receive notifications on iOS, add this page to your Home Screen first. Tap for instructions.":
    "Lägg först till sidan på hemskärmen för att få notiser på iOS. Tryck för instruktioner.",
  "Get Notifications on iOS": "Få notiser på iOS",
  "Install this app on your Home Screen before enabling push notifications on iOS.":
    "Installera appen på hemskärmen innan du aktiverar pushnotiser på iOS.",
  "Tap the Share button in Safari": "Tryck på Dela i Safari",
  'Scroll down and tap "Add to Home Screen"': 'Rulla ned och tryck på "Lägg till på hemskärmen"',
  "Open the app from your Home Screen": "Öppna appen från hemskärmen",
  'Come back here and tap "Get Notifications"': 'Gå tillbaka hit och tryck på "Få notiser"',
  "No subscription endpoint found": "Ingen prenumeration hittades",
  "Unsubscribing from notifications...": "Avslutar notiser...",
  "Unsubscribed from notifications!": "Notiser har avslutats!",
  "Failed to unsubscribe from notifications": "Det gick inte att avsluta notiser",
  "Subscribing to notifications...": "Aktiverar notiser...",
  "Subscribed to notifications!": "Notiser har aktiverats!",
  "Failed to subscribe to notifications": "Det gick inte att aktivera notiser",
  "For You": "För dig",
  "Everything you need to share the journey": "Allt du behöver för att dela resan",
  "Update Your Status": "Uppdatera statusen",
  "One tap updates everyone — labour started, at the hospital, baby's here. No group texts or repeated calls.":
    "Ett tryck uppdaterar alla — förlossningen har börjat, ni är på sjukhuset eller bebisen är här. Inga gruppmeddelanden eller upprepade samtal.",
  "Countdown to Due Date": "Nedräkning till beräknad födsel",
  "Set the due date so everyone can see how many days are left, including a friendly overdue counter.":
    "Ange beräknat datum så att alla ser hur många dagar som återstår, även efter datumet.",
  "Make It Yours": "Gör sidan personlig",
  "Choose a theme that matches your style — your page, your way.":
    "Välj ett tema som passar din stil — din sida på ditt sätt.",
  "For Your Family & Friends": "För familj och vänner",
  "What everyone you share with gets": "Det här får alla du delar sidan med",
  "No Account Needed": "Inget konto behövs",
  "Anyone with the link can follow along without downloading an app or creating an account.":
    "Alla med länken kan följa med utan att ladda ned en app eller skapa ett konto.",
  "Visitors can leave messages of love and support in a digital guestbook.":
    "Besökare kan lämna kärleksfulla hälsningar i en digital gästbok.",
  "Get Notified": "Få notiser",
  "Subscribe to updates and hear the moment baby arrives without constantly refreshing.":
    "Prenumerera på uppdateringar och få veta direkt när bebisen kommer.",
  "See It In Action": "Se hur det fungerar",
  "Open any stage to preview the baby page": "Öppna ett steg för att förhandsvisa bebissidan",
  Waiting: "Väntar",
  "Before labour starts": "Innan förlossningen börjar",
  "Things are happening!": "Nu händer det!",
  "At Hospital": "På sjukhuset",
  "Almost there!": "Snart är det dags!",
  "Baby Born!": "Bebisen är född!",
  "Celebrate the arrival": "Fira ankomsten",
  "How It Works": "Så fungerar det",
  "Up and running in under a minute": "Kom igång på mindre än en minut",
  "Create Your Page": "Skapa din sida",
  "Sign up and add your baby's name and due date. That's it.":
    "Registrera dig och lägg till bebisens namn och beräknade datum. Klart!",
  "Share the Link": "Dela länken",
  "Send it to family and friends. They can follow along and subscribe without an account.":
    "Skicka den till familj och vänner. De kan följa med och prenumerera utan konto.",
  "Update as You Go": "Uppdatera längs vägen",
  "Post each milestone once and everyone following gets the news.":
    "Publicera varje milstolpe en gång så får alla följare nyheten.",
  "Ready to share the journey?": "Redo att dela resan?",
  "Head back to your dashboard to keep everyone updated.":
    "Gå tillbaka till översikten och håll alla uppdaterade.",
  "Join families already sharing their special moments. It takes less than a minute.":
    "Gör som andra familjer och dela era speciella stunder. Det tar mindre än en minut.",
  "Get Started Free": "Kom igång gratis",
  "Open source on GitHub": "Öppen källkod på GitHub",
  "Preview – {{title}}": "Förhandsvisning – {{title}}",
  "Preview how your baby tracking page will look at different stages.":
    "Förhandsvisa hur bebissidan ser ut i olika steg.",
  "Page Not Found": "Sidan hittades inte",
  "Looks like this page hasn't arrived yet. Let's get you back home!":
    "Den här sidan verkar inte ha kommit än. Vi tar dig tillbaka hem!",
  "Go Home": "Gå hem",
};

const es: Record<TranslationKey, string> = {
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
  "{{count}} day overdue – Is {{name}} out yet?": "{{count}} día de retraso – ¿Ya nació {{name}}?",
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
  "Photo of {{name}}": "Foto de {{name}}",
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
  "All visitors see this page in {{language}}.":
    "Todos los visitantes ven esta página en {{language}}.",
  Default: "Predeterminado",
  "Violet Bloom": "Violet Bloom",
  "Twitter Blue": "Twitter Blue",
  Bubblegum: "Bubblegum",
  Catppuccin: "Catppuccin",
  "Mocha Mousse": "Mocha Mousse",
  "Quantum Rose": "Quantum Rose",
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
  "Photo added": "Foto añadida",
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
  "Add a message, a photo, or a milestone to post":
    "Añade un mensaje, una foto o un hito para publicar",
  "Pick a valid time — or leave it as now": "Elige una hora válida o déjala como ahora",
  "Please select an image file": "Selecciona un archivo de imagen",
  "Photo must be 10 MB or smaller": "La foto debe pesar 10 MB o menos",
  "Failed to upload photo": "No se pudo subir la foto",
  "Update posted!": "¡Novedad publicada!",
  "Post an update": "Publicar una novedad",
  "Everyone following {{name}}'s page will see it. A message, a photo, a milestone — each is optional, any mix works.":
    "Todos los que siguen la página de {{name}} la verán. El mensaje, la foto y el hito son opcionales y se pueden combinar.",
  "Write a message (optional)…": "Escribe un mensaje (opcional)…",
  "Update message (optional)": "Mensaje de la novedad (opcional)",
  "Photo to post": "Foto para publicar",
  "Remove photo": "Quitar foto",
  "Status change (optional)": "Cambio de estado (opcional)",
  "No status change": "Sin cambio de estado",
  'This changes the page status to "{{status}}" and notifies everyone subscribed.':
    'Esto cambia el estado de la página a "{{status}}" y avisa a todos los suscriptores.',
  "When did it happen?": "¿Cuándo ocurrió?",
  "Defaults to now — set an earlier time if you're sharing the news after the fact.":
    "La hora predeterminada es ahora. Elige una anterior si lo cuentas después.",
  "Change photo": "Cambiar foto",
  "Add photo (optional)": "Añadir foto (opcional)",
  "Posting...": "Publicando...",
  'Post & mark "{{status}}"': 'Publicar y marcar "{{status}}"',
  "Add a message, a photo, or a milestone — any one is enough.":
    "Añade un mensaje, una foto o un hito.",
  "Posted {{date}}": "Publicado {{date}}",
  "Set as page photo": "Usar como foto de la página",
  "Delete update": "Eliminar novedad",
  "Delete update?": "¿Eliminar la novedad?",
  "This also unmarks the milestone on the status card.":
    "También desmarca el hito en la tarjeta de estado.",
  "This removes the update from the timeline.": "Esto elimina la novedad de la cronología.",
  "If this photo is the current page photo, the previous one takes its place.":
    "Si esta es la foto actual, la anterior ocupará su lugar.",
  "This action cannot be undone.": "Esta acción no se puede deshacer.",
  Delete: "Eliminar",
  "View photo full size": "Ver foto a tamaño completo",
  "Baby update": "Novedad del bebé",
  "Close photo": "Cerrar foto",
  "Message cannot be empty": "El mensaje no puede estar vacío",
  "Edit your message": "Editar tu mensaje",
  "Saving...": "Guardando...",
  "(you)": "(tú)",
  "Edit encouragement": "Editar mensaje de ánimo",
  "Delete encouragement": "Eliminar mensaje de ánimo",
  "Delete Encouragement?": "¿Eliminar el mensaje de ánimo?",
  "Are you sure you want to delete this encouragement from {{name}}? This action cannot be undone.":
    "¿Quieres eliminar el mensaje de ánimo de {{name}}? Esta acción no se puede deshacer.",
  "Update removed": "Novedad eliminada",
  "Failed to remove update": "No se pudo eliminar la novedad",
  "Set as the page photo": "Establecida como foto de la página",
  "Failed to set page photo": "No se pudo cambiar la foto de la página",
  "Encouragement removed": "Mensaje de ánimo eliminado",
  "Failed to remove encouragement": "No se pudo eliminar el mensaje de ánimo",
  "Encouragement updated": "Mensaje de ánimo actualizado",
  "Failed to update encouragement": "No se pudo actualizar el mensaje de ánimo",
  "Notification sent!": "¡Notificación enviada!",
  "{{count}} person": "{{count}} persona",
  "{{count}} people": "{{count}} personas",
  "Notification cancelled": "Notificación cancelada",
  "Failed to cancel notification": "No se pudo cancelar la notificación",
  "Sending notification...": "Enviando notificación...",
  "Push notifications are not supported in this browser.":
    "Este navegador no admite notificaciones push.",
  "Notification permission denied": "Permiso de notificaciones denegado",
  "Notification permission is required": "Se requiere permiso para las notificaciones",
  "Failed to get subscription data": "No se pudieron obtener los datos de suscripción",
  "To receive notifications on iOS, add this page to your Home Screen first. Tap for instructions.":
    "Para recibir notificaciones en iOS, añade primero esta página a la pantalla de inicio. Toca para ver las instrucciones.",
  "Get Notifications on iOS": "Recibir notificaciones en iOS",
  "Install this app on your Home Screen before enabling push notifications on iOS.":
    "Instala esta aplicación en la pantalla de inicio antes de activar las notificaciones push en iOS.",
  "Tap the Share button in Safari": "Toca el botón Compartir en Safari",
  'Scroll down and tap "Add to Home Screen"':
    'Desplázate hacia abajo y toca "Añadir a pantalla de inicio"',
  "Open the app from your Home Screen": "Abre la aplicación desde la pantalla de inicio",
  'Come back here and tap "Get Notifications"':
    'Vuelve aquí y toca "Recibir notificaciones"',
  "No subscription endpoint found": "No se encontró la suscripción",
  "Unsubscribing from notifications...": "Cancelando las notificaciones...",
  "Unsubscribed from notifications!": "¡Notificaciones canceladas!",
  "Failed to unsubscribe from notifications": "No se pudieron cancelar las notificaciones",
  "Subscribing to notifications...": "Activando las notificaciones...",
  "Subscribed to notifications!": "¡Notificaciones activadas!",
  "Failed to subscribe to notifications": "No se pudieron activar las notificaciones",
  "For You": "Para ti",
  "Everything you need to share the journey": "Todo lo que necesitas para compartir el camino",
  "Update Your Status": "Actualiza el estado",
  "One tap updates everyone — labour started, at the hospital, baby's here. No group texts or repeated calls.":
    "Un toque informa a todos: comenzó el parto, estáis en el hospital o el bebé ya llegó. Sin grupos ni llamadas repetidas.",
  "Countdown to Due Date": "Cuenta atrás para la fecha prevista",
  "Set the due date so everyone can see how many days are left, including a friendly overdue counter.":
    "Indica la fecha prevista para que todos vean cuántos días faltan, incluso si se retrasa.",
  "Make It Yours": "Hazla tuya",
  "Choose a theme that matches your style — your page, your way.":
    "Elige un tema que vaya con tu estilo: tu página, a tu manera.",
  "For Your Family & Friends": "Para familiares y amigos",
  "What everyone you share with gets": "Lo que reciben las personas con quienes compartes",
  "No Account Needed": "Sin necesidad de cuenta",
  "Anyone with the link can follow along without downloading an app or creating an account.":
    "Cualquiera con el enlace puede seguirlo sin descargar una aplicación ni crear una cuenta.",
  "Visitors can leave messages of love and support in a digital guestbook.":
    "Los visitantes pueden dejar mensajes de cariño y apoyo en un libro digital.",
  "Get Notified": "Recibe notificaciones",
  "Subscribe to updates and hear the moment baby arrives without constantly refreshing.":
    "Suscríbete y entérate cuando llegue el bebé sin actualizar la página constantemente.",
  "See It In Action": "Mira cómo funciona",
  "Open any stage to preview the baby page": "Abre cualquier etapa para ver la página del bebé",
  Waiting: "En espera",
  "Before labour starts": "Antes de que comience el parto",
  "Things are happening!": "¡Ya está pasando!",
  "At Hospital": "En el hospital",
  "Almost there!": "¡Ya falta poco!",
  "Baby Born!": "¡El bebé ha nacido!",
  "Celebrate the arrival": "Celebra la llegada",
  "How It Works": "Cómo funciona",
  "Up and running in under a minute": "Todo listo en menos de un minuto",
  "Create Your Page": "Crea tu página",
  "Sign up and add your baby's name and due date. That's it.":
    "Regístrate y añade el nombre y la fecha prevista del bebé. Eso es todo.",
  "Share the Link": "Comparte el enlace",
  "Send it to family and friends. They can follow along and subscribe without an account.":
    "Envíalo a familiares y amigos. Pueden seguirlo y suscribirse sin tener una cuenta.",
  "Update as You Go": "Actualiza sobre la marcha",
  "Post each milestone once and everyone following gets the news.":
    "Publica cada hito una vez y todos los seguidores recibirán la noticia.",
  "Ready to share the journey?": "¿Listo para compartir el camino?",
  "Head back to your dashboard to keep everyone updated.":
    "Vuelve al panel para mantener a todos informados.",
  "Join families already sharing their special moments. It takes less than a minute.":
    "Únete a las familias que ya comparten sus momentos especiales. Tardarás menos de un minuto.",
  "Get Started Free": "Empieza gratis",
  "Open source on GitHub": "Código abierto en GitHub",
  "Preview – {{title}}": "Vista previa – {{title}}",
  "Preview how your baby tracking page will look at different stages.":
    "Comprueba cómo se verá la página del bebé en las distintas etapas.",
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

export function translate<TKey extends TranslationKey>(
  locale: SupportedLocale,
  key: TKey,
  ...args: TranslationArguments<TKey>
) {
  const variables = args[0] ?? {};
  let message: string = translations[locale][key] ?? enGB[key];
  for (const [name, value] of Object.entries(variables)) {
    message = message.replaceAll(`{{${name}}}`, () => String(value));
  }
  return message;
}

export function useI18n() {
  const locale = useContext(LocaleContext);
  return useMemo(
    () => ({
      locale,
      t: (<TKey extends TranslationKey>(
        key: TKey,
        ...args: TranslationArguments<TKey>
      ) => translate(locale, key, ...args)) satisfies TranslationFunction,
    }),
    [locale],
  );
}

export function getLanguageName(locale: SupportedLocale, displayLocale: SupportedLocale = locale) {
  return new Intl.DisplayNames([displayLocale], { type: "language" }).of(locale) ?? locale;
}
