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

**Texto promocional (170):** Still aparece un segundo antes de las apps que eliges. Vuelves, o entras por el tiempo que decidas. Los anuncios opcionales financian un fondo semanal de impacto.

**Palabras clave (100):** pausa,atajos,bienestar digital,enfoque,redes sociales,hábitos,concentración,distracción,uso

**Descripción:**

Still aparece un segundo antes de las apps que abres por reflejo. Hace visible la decisión; no la toma por ti.

CÓMO FUNCIONA
• Eliges las apps que quieres pausar.
• Creas una automatización personal en la app Atajos de Apple: «Cuando se abra [app] → Pausar antes de abrir». Still te guía paso a paso.
• Cuando abres esa app, Still aparece con dos caminos: volver, o ver un anuncio opcional y entrar por el tiempo que elegiste.

UNA PAUSA QUE CUENTA
Los anuncios son opcionales. La plataforma asigna el 80 % de su ingreso publicitario a un fondo semanal. Votas qué proyecto lo recibe y ves el monto estimado, el confirmado y el comprobante de cada donación.

SIN CULPA NI RACHAS
Still no usa puntajes, rachas ni mensajes que juzguen tu tiempo. Muestra lo que pasó hoy: cuántas veces se abrió cada app y cuánto tiempo recuperaste.

PRIVADO POR DISEÑO
Los nombres de las apps que eliges y tu historial detallado se quedan en el iPhone. Still no crea ni lee tus automatizaciones.

NUNCA QUEDAS BLOQUEADO
Si no hay anuncio disponible ni un pase guardado, una pausa breve te deja entrar igual.

Still es para personas de 18 años o más.

**Novedades de esta versión:** Primera versión de Still para iPhone.

### English (U.S.)

**Subtitle (30):** A pause before you open

**Promotional text (170):** Still appears a second before the apps you choose. Go back, or go in for the time you pick. Optional ads fund a weekly impact fund.

**Keywords (100):** pause,shortcuts,digital wellbeing,focus,social media,habits,attention,distraction,phone use

**Description:**

Still appears a second before the apps you open on reflex. It makes the decision visible; it doesn't make it for you.

HOW IT WORKS
• Choose the apps you want to pause.
• Create a personal automation in Apple's Shortcuts app: "When [app] is opened → Pause Before Opening". Still walks you through it.
• When you open that app, Still shows two paths: go back, or watch an optional ad and go in for the time you chose.

A PAUSE THAT COUNTS
Ads are optional. The platform allocates 80% of its advertising revenue to a weekly fund. You vote on which project receives it and see the estimated amount, the confirmed amount and the receipt for every donation.

NO GUILT, NO STREAKS
Still has no scores, streaks or messages that judge your time. It shows what happened today: how many times each app was opened and how much time you got back.

PRIVATE BY DESIGN
The names of the apps you choose and your detailed history stay on your iPhone. Still never creates or reads your automations.

NEVER LOCKED OUT
If no ad is available and you have no saved pass, a short pause still lets you in.

Still is for people 18 and older.

**What's new:** The first version of Still for iPhone.

### App Review notes

> Still adds an intentional pause before apps the user chooses. iOS gives apps no way to observe other apps, so the user creates a personal automation in Apple's Shortcuts app ("When [app] is opened → Pause Before Opening", an App Intent provided by Still). Still never creates, edits or reads automations; the in-app guide only explains the steps and opens the Shortcuts app.
>
> To review: 1) open Still and finish onboarding (no account needed; the session is anonymous); 2) choose an app such as YouTube under "Apps with a pause"; 3) follow the steps shown to create the automation in Shortcuts; 4) open that app. Still comes to the foreground and offers "Watch ad" or "I don't want to go in anymore". The ad is a rewarded ad and only starts after the user taps "Watch ad". After it completes, the user chooses "I want to go in" (Still reopens the app through its public URL scheme) or "I don't want to go in anymore". Personal automations do not run in the iOS Simulator, so please review on a device.
>
> The target app is visible for a moment before Still appears. That is how iOS orders app launch and automations, not something Still controls.
>
> Still does not block, hide or restrict any app, and it does not use Screen Time or Family Controls. The user can remove the automation in Shortcuts at any time and Still stops appearing.
>
> Sign in with Apple (and Google) is optional: it is only used to vote for the weekly impact project and to recover the account on a new phone (Settings → Account, or Impact → Vote). Account deletion is in Settings → Privacy → "Delete account and data".
>
> The names of the chosen apps stay on the device: they are stored in the App Group and are never sent to our servers or to analytics.

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
• Cuando abres esa app, Still aparece con dos caminos: volver, o ver un anuncio opcional y entrar por el tiempo que elegiste.

and "se quedan en el iPhone" with "se quedan en tu teléfono". English: same substitutions.
