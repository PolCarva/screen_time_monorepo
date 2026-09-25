# Store listings

Copy for App Store Connect and Google Play. Spanish (Mexico / Latin America) is the primary locale; English (U.S.) is the secondary one. Keep numbers in sync with the published remote config (`impactPercentage`).

## Shared URLs

| Field | URL |
| --- | --- |
| Marketing / website | https://screen-time-monorepo-web.vercel.app |
| Support | https://screen-time-monorepo-web.vercel.app/soporte |
| Privacy policy | https://screen-time-monorepo-web.vercel.app/privacy |
| Account deletion (Play) | https://screen-time-monorepo-web.vercel.app/eliminar-cuenta |
| Contact email | pablocarvalhogimenez@gmail.com |

## App Store (iOS) — `app.still.ios`, Apple ID 6815465306

- Category: Productivity (primary), Lifestyle (secondary).
- Price: free. Availability: all countries and regions (trader status declared for the EU).
- Age rating: 18+ (the app's own age gate and terms).
- Copyright: 2026 Pablo Carvalho.
- Sign-in required for review: no (the account is anonymous; Apple or Google is only needed to vote).

### Español (México)

**Subtítulo (30):** Una pausa antes de entrar

**Texto promocional (170):** Still aparece un segundo antes de las apps que eliges. Vuelves, o ves un anuncio y entras por el tiempo que decidas. Los anuncios financian un fondo semanal de impacto.

**Palabras clave (100):** pausa,atajos,bienestar digital,enfoque,redes sociales,hábitos,concentración,distracción,uso

**Descripción:**

Still aparece un segundo antes de las apps que abres por reflejo. Hace visible la decisión; no la toma por ti.

CÓMO FUNCIONA
• Eliges las apps que quieres pausar.
• En la app Atajos de Apple creas una automatización personal por cada app: «Cuando se abra [app]» con la acción de Still «Pausar [app]», que ya viene lista. Still te guía paso a paso y comprueba que funcione.
• Cuando abres esa app, Still aparece antes. Puedes volver sin entrar, o ver un anuncio y entrar por el tiempo que elijas, desde un minuto hasta el resto del día.

UNA PAUSA QUE CUENTA
Entrar cuesta un anuncio; tú nunca pagas nada. La plataforma asigna el 80 % de su ingreso publicitario a un fondo semanal que dona a una organización social. Con tu cuenta de Apple o Google votas cuál lo recibe, y ves el monto estimado, el confirmado y el comprobante de cada donación.

SIN CULPA NI RACHAS
Still no usa puntajes, rachas ni mensajes que juzguen tu tiempo. Muestra lo que pasó hoy: cuántas veces se abrió cada app y cuánto tiempo recuperaste.

PRIVADO POR DISEÑO
Los nombres de las apps que eliges y tu historial detallado se quedan en el iPhone. Still no crea ni lee tus automatizaciones, y no usa Tiempo en pantalla.

NUNCA QUEDAS BLOQUEADO
Si no hay un anuncio disponible, una pausa de 15 segundos te deja entrar 5 minutos. Y puedes borrar la automatización en Atajos cuando quieras.

Still es para personas de 18 años o más.

**Novedades de esta versión:** Primera versión de Still para iPhone.

### English (U.S.)

**Subtitle (30):** A pause before you open

**Promotional text (170):** Still appears a second before the apps you choose. Go back, or watch an ad and go in for the time you pick. The ads fund a weekly impact fund.

**Keywords (100):** pause,shortcuts,digital wellbeing,focus,social media,habits,attention,distraction,phone use

**Description:**

Still appears a second before the apps you open on reflex. It makes the decision visible; it doesn't make it for you.

HOW IT WORKS
• Choose the apps you want to pause.
• In Apple's Shortcuts app, create one personal automation per app: "When [app] is opened" with Still's ready-made action "Pause [app]". Still walks you through it and checks that it works.
• When you open that app, Still appears first. Go back without going in, or watch an ad and go in for the time you choose, from one minute to the rest of the day.

A PAUSE THAT COUNTS
Going in costs one ad; you never pay anything. The platform allocates 80% of its advertising revenue to a weekly fund that it donates to a social organization. With your Apple or Google account you vote on which one receives it, and you see the estimated amount, the confirmed amount and the receipt for every donation.

NO GUILT, NO STREAKS
Still has no scores, streaks or messages that judge your time. It shows what happened today: how many times each app was opened and how much time you got back.

PRIVATE BY DESIGN
The names of the apps you choose and your detailed history stay on your iPhone. Still never creates or reads your automations, and it doesn't use Screen Time.

NEVER LOCKED OUT
If no ad is available, a 15-second pause lets you in for 5 minutes. And you can delete the automation in Shortcuts at any time.

Still is for people 18 and older.

**What's new:** The first version of Still for iPhone.

### App Review notes

Paste into App Store Connect → App Review Information → Notes (limit 4000 characters; this is about 3735) and attach the screen recording. The longer reply to App Review is in `docs/app-store-review-plan.md` §11.

> Information requested under Guideline 2.1 for version 0.3.1. A screen recording made on an iPhone with iOS 27 is attached here and in our reply in App Review.
>
> 1. PURPOSE AND AUDIENCE
> Still is for adults (18+) who open some apps on reflex and want a moment to decide. The user chooses apps; each time one of them opens, Still shows a short pause first. Still shows how many times each app was opened today and the time given back. It does not block, hide or restrict any app.
>
> 2. HOW TO REVIEW (physical device: Shortcuts personal automations do not run in the Simulator)
> No login is needed: Still creates an anonymous session by itself.
> a) Open Still, go through the onboarding and confirm you are 18+.
> b) Choose Calendar or Maps (both are on every iPhone).
> c) Follow the in-app guide: Shortcuts > Automation > + > App > Choose > Calendar > blue checkmark > Run Immediately > Next > Create New Shortcut > Search Actions: "Still" > tap "Calendar" under "Pause App" (the ready-made action "Pause Calendar") > blue checkmark. Back in Still, tap Test.
> d) Open Calendar. Still comes to the front with "I don't want to go in anymore" or "Watch ad". The rewarded ad only starts after "Watch ad"; afterwards the user picks how long (1 minute to the rest of the day) and Still reopens Calendar through its public URL scheme. If no ad loads within 12 seconds, a 15-second breathing pause lets the user in for 5 minutes.
> The target app is visible for a moment before Still appears: iOS runs the automation after the app opens.
> Ads are not being served to the iOS app on real devices yet, so on a device "Watch ad" shows "Preparing the ad..." for up to 12 seconds and then the 15-second pause. The last part of the recording uses the iOS Simulator with the same build, where Google serves its test ads, to show the rewarded-ad path.
> e) Optional account: Settings > Account > Sign in with Apple (or Google). It is only used to vote for the weekly project (Impact tab) and to recover the account on a new phone.
> f) Account deletion: Settings > Your data > "Delete account and data". With an Apple ID linked, Apple asks to confirm and our server revokes the token (Sign in with Apple REST API) before deleting. The privacy policy is in Settings > Your data.
>
> 3. EXTERNAL SERVICES
> Supabase (anonymous authentication and database); our own API on Vercel; Sign in with Apple; Google Sign-In (optional); Google AdMob (rewarded ads, non-personalized; Google's consent form in the EEA, UK and Switzerland); Apple Shortcuts / App Intents; Apple Push Notification service (reminder when the chosen time ends).
>
> 4. REGIONS
> The app works the same in every region, in Spanish and English. Google's consent form only appears in the EEA, UK and Switzerland. Ad availability varies by region; with no ad, the 15-second pause applies. The candidate organizations of the weekly fund are in Uruguay.
>
> 5. MONEY, CHARITIES AND THIRD-PARTY MATERIAL
> Not a regulated industry. There are no in-app purchases, payments or donations: users never pay. The developer allocates 80% of Still's ad revenue to a weekly donation that the developer makes through each organization's public donation channel; users vote on which organization receives it, and the receipt is published in the app. The organizations (Cruz Roja Uruguaya, Fundación Pérez Scremini, Karumbé) are shown by name with their public websites for transparency; they are not affiliated with Still and do not endorse it. Other apps' names appear only as text, so the user can choose which apps to pause and Still can reopen them through their public URL schemes. Still never reads, blocks or modifies other apps, does not request Screen Time (Family Controls) access, and keeps the chosen app names on the device.

## Google Play (Android) — `com.still.screentime`

- App name (30): Still: pausa antes de entrar
- Category: Productivity. Contains ads: yes. Target audience: 18+.
- Developer name: Still Screen Time.

**Descripción breve (80):** Una pausa de un segundo antes de las apps que eliges. Tú decides si entras.

**Short description (80):** A one-second pause before the apps you choose. You decide whether to go in.

**Descripción completa:** same as the App Store description, replacing the "CÓMO FUNCIONA" block with:

CÓMO FUNCIONA
• Eliges las apps que quieres pausar.
• Activas Accesibilidad para Still. La usa solo para saber cuándo se abre una de esas apps y mostrar la pausa, y para cerrar un video flotante que la tape.
• Cuando abres esa app, Still aparece antes. Puedes volver sin entrar, o ver un anuncio y entrar por el tiempo que elijas, desde un minuto hasta el resto del día.

and "se quedan en el iPhone. Still no crea ni lee tus automatizaciones, y no usa Tiempo en pantalla." with "se quedan en tu teléfono.", and "Y puedes borrar la automatización en Atajos cuando quieras." with "Y puedes desactivar Still en Ajustes cuando quieras.". English: same substitutions.
