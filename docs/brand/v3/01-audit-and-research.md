# Screen Time v3 — audit e investigación

## Alcance

La v3 debe sentirse como un objeto digital contemporáneo: calmado, humano, táctil y tecnológico. Este documento registra qué se intentó en las dos ramas anteriores, qué se conserva a nivel funcional y qué referencias externas informan la nueva dirección. Ninguna referencia funciona como plantilla visual.

## Audit de las direcciones anteriores

### `codex/still-editorial-system`

**Lo que funciona**

- El producto se explica mediante decisiones, duraciones, estados y comprobantes concretos.
- El naranja Signal crea un momento de interrupción reconocible.
- El uso de reglas, tablas y secuencias evita buena parte de las cards SaaS.
- La relación entre app, web, impacto y campaña es consistente.
- La jerarquía entre “salir” y “continuar” es correcta y no moralista.

**Lo que no funciona para v3**

- El sistema se siente como un manifiesto editorial trasladado a una app: titulares demasiado grandes, negro/naranja agresivo y demasiada voz gráfica para una herramienta de uso diario.
- En mobile, la escala tipográfica consume el primer viewport y debilita la lectura instrumental.
- La home no responde de forma compacta a las cinco preguntas de producto: tiempo evitado, apps protegidas, progreso, impacto y siguiente acción.
- La fotografía está descrita en el brandbook, pero casi no participa en la identidad implementada.
- Las campañas dependen sobre todo de macro-tipografía y mockups de teléfono.
- La barra de tabs flotante y redondeada contradice el propio principio de “menos contenedores”.
- El isotipo Interval S y el “corte” son coherentes, pero pertenecen a la dirección editorial y no deben gobernar la v3.

### `codex/still-tactile-zen`

**Lo que funciona**

- La temperatura general es más amable y silenciosa.
- Web, app, extensiones nativas, icono y splash comparten una paleta consistente.
- La materialidad mate y la reducción del acento naranja mejoran la calma.
- La pieza tridimensional demuestra que un recurso físico puede integrarse técnicamente en el producto.

**Lo que no funciona para v3**

- La hoja, la piedra, la semilla, el verde salvia y la serif traducen “natural” de forma literal.
- La marca se acerca demasiado a meditación, cosmética wellness y eco-branding.
- La seed stone no representa información: es un objeto ornamental y termina dominando la experiencia.
- La combinación Cormorant + beige + verde + whitespace es un atajo visual demasiado predecible.
- Radios grandes, sombras suaves y superficies elevadas convierten demasiadas secciones en cards.
- El grano global se percibe como filtro; la textura debería aparecer sólo en planos materiales concretos.
- El motion flotante es decorativo y no comunica estado ni decisión.
- La home mantiene el problema funcional de la versión editorial y no presenta de inmediato las cinco respuestas requeridas.

## Base funcional y restricciones reales

- Expo Router con tabs nativas, onboarding, Hoy, Pases, Impacto, Ajustes, Intervención y Unlock Ready.
- iOS usa FamilyControls, ManagedSettings Shield y DeviceActivityReport; los nombres de apps deben permanecer locales.
- Android usa Accessibility Service, selector local e intervención nativa.
- El estado ya ofrece tiempo controlado, intentos, aperturas evitadas, desbloqueos, datos semanales, wallet y configuración.
- `RestrictionHealth` ya contiene `selectedCount`; la v3 debe llevar ese estado a la home y ofrecer acceso directo para revisar la selección.
- Impacto tiene estados distintos —estimado, conciliado, donado y publicado— que deben conservarse.
- La web ya dispone de rutas de producto, impacto y privacidad, pero la narrativa y el lenguaje visual pueden reconstruirse.

## Referencias externas

| Referencia | Principio transferible | Qué no copiar |
| --- | --- | --- |
| [one sec](https://one-sec.app/) | La fricción breve puede cambiar una acción automática sin bloquear toda la agencia. | Respiración como recurso central, tono de “adicción/dopamina” y su intervención visual. |
| [Opal brand kit](https://brandkit.opal.so/) | Una marca de producto puede reservar recursos expresivos para hitos concretos y mantener la UI disciplinada. | Negro total, gemas 3D, scores, streaks y estética de recompensa. |
| [Brick](https://getbrick.app/) | La fricción física y una acción única pueden explicar el producto mejor que muchas features. | El dispositivo cuadrado, el copy “take back your time” y la narrativa de productividad. |
| [reMarkable Paper Pro](https://remarkable.com/products/remarkable-paper/pro/details/features) | Materialidad y tecnología pueden convivir cuando la textura mejora la acción y la interfaz se retira. | Simular papel en toda la app o convertir Screen Time en un producto e-ink. |
| [Teenage Engineering OP–1 field](https://teenage.engineering/products/op-1) | Color localizado, leyendas precisas y controles con función crean identidad sin decorar superficies completas. | Botones de sintetizador, códigos cromáticos o estética retro-instrumental literal. |
| [Naoto Fukasawa — Without Thought](https://naotofukasawa.com/about/) | Diseñar alrededor de conductas inconscientes permite intervenir sin culpabilizar. | Copiar formas de objetos domésticos o perseguir minimalismo como estilo vacío. |
| [Norm Architects — Soft Minimal](https://normcph.com/project/soft-minimal-2/) | Luz, sombra, proporción y tactilidad pueden humanizar geometrías simples. | Interiores beige como moodboard y “soft minimalism” aplicado sin función. |
| [Muuto — materiales](https://www.muuto.com/content/about/materials-and-care/) | El detalle material puede permanecer invisible de lejos y revelarse al acercarse. | Texturas de madera/lana o códigos escandinavos literales. |
| [Snow Peak](https://www.snowpeak.com/blogs/explore/the-mission) | La naturaleza puede aparecer mediante uso, contexto, durabilidad y fotografía de objetos funcionales. | Montañas, camping aspiracional o outdoor como disfraz temático. |
| [Rinko Kawauchi](https://rinkokawauchi.com/) | Luz disponible, escala íntima y momentos cotidianos sin teléfono pueden comunicar atención humana. | Imitar encuadres reconocibles o volver toda la fotografía etérea y sentimental. |
| [Dear Data](https://www.dear-data.com/theproject) | La imperfección controlada puede volver personales los datos sin quitarles significado. | Diagramas dibujados a mano, paletas multicolor y complejidad decorativa. |
| [MIT — data physicalization](https://www-prod.media.mit.edu/projects/making-data-matter/overview/) | Los datos pueden adquirir volumen, material y acumulación física. | 3D espectacular o geometría que no pueda explicarse con los datos. |
| [Stripe Climate](https://stripe.com/climate) | El impacto gana credibilidad al mostrar portfolio, criterio, estado y limitaciones. | Estética climate-tech, imagery científica o claims de carbono ajenos al producto. |
| [Watershed](https://watershed.com/en-GB/platform) | Trazabilidad y lineage convierten una cifra ambiental en evidencia. | Dashboard empresarial, densidad ESG y lenguaje corporativo. |
| [Center for Humane Technology](https://www.humanetech.com/humane-product-design) | La psicología humana debe tratarse como restricción de diseño, no como superficie de optimización. | Lenguaje activista dominante o convertir la app en una declaración ética. |
| [Apple HIG — Motion](https://developer.apple.com/design/human-interface-guidelines/motion) | Motion breve y preciso debe mostrar estado, feedback o continuidad; debe poder omitirse. | Bounce, oscilación permanente y movimiento que retrase una acción frecuente. |
| [Apple HIG — App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons) | Un icono necesita una idea simple, pocas formas y variantes coherentes a 32 px. | Reloj, móvil, screenshot, texto o componente de UI replicado. |
| [Recursive Sans & Mono](https://www.recursive.design/) | Una misma familia puede pasar de precisa/mono a humana/casual sin reflow, y convertir el cambio de estado en identidad tipográfica. | Usar los ejes como demo técnica o animarlos en cada texto. |
| [Onest](https://onest.md/en) | Una grotesca humana puede conservar claridad en tamaños pequeños sin sentirse anónima. | Repetir el aspecto Swiss de forma genérica. |

## Principios extraídos

1. **La calma es operativa.** Menos decisiones simultáneas, jerarquía inequívoca y feedback inmediato.
2. **La identidad vive en el comportamiento.** El momento automático y el momento consciente deben verse y moverse distinto.
3. **Una superficie no es una card.** Planos, alineación, divisores y color estructuran antes que radio y sombra.
4. **El dato principal gobierna.** La home necesita una sola métrica protagonista y una secuencia secundaria compacta.
5. **La materialidad pertenece a información concreta.** Textura o profundidad sólo donde explican acumulación, estado o tacto.
6. **El impacto es un registro.** Monto, origen, periodo, estado y prueba antes que emoción.
7. **Fotografía de ausencia.** Luz, espacio, movimiento y objetos cotidianos; el teléfono no protagoniza.
8. **Motion con salida.** Toda animación debe responder, revelar progreso o efectuar el cambio automático → consciente.

## Límites de la v3

- Sin hojas, piedras, semillas, árboles, planetas, blobs o mascota.
- Sin Cormorant, Interval S, naranja Signal ni seed stone.
- Sin score, streak anxiety, confetti o culpa.
- Sin capa global de grano.
- Sin progress rings ni barras SaaS genéricas.
- Sin hero seguido por tres cards de beneficios.
- Sin 3D que no pueda describirse mediante un dato concreto.
