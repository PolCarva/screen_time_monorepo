import { Linking, StyleSheet, View } from "react-native";

import { EXAMPLE_APP, FAKE_APP } from "@/components/guide/app-icons";
import { GuideCard } from "@/components/guide/guide-card";
import { SHORTCUTS_SCREENS } from "@/components/guide/ios-shortcuts-screens";
import {
  ShortcutStepVisual,
  type ShortcutStepVisualVariant,
} from "@/components/shortcut-step-visual";
import { useStillSheet } from "@/components/still-sheet";
import { Body, Heading, Mono } from "@/components/typography";
import { localize, sys } from "@/i18n";
import {
  type GuideLink,
  type GuideStep,
  SHORTCUTS_APP_URL,
  type SetupStepId,
  guideLinkUrl,
} from "@/lib/ios-shortcut-setup";
import { offerShortcutsInstall } from "@/lib/shortcuts-app";
import { colors, spacing } from "@/theme/tokens";

type StepCopy = {
  title: string;
  body: string;
  /** Drawn mock-up, only for the tiers that have no replica of Shortcuts yet. */
  visual?: ShortcutStepVisualVariant;
  visualLabel: string;
};

/** A Shortcuts label quoted the way each language quotes: “Next”, «Siguiente». */
export function q(label: string) {
  return localize(`“${label}”`, `«${label}»`);
}

/**
 * One step = one action. The title is the button to tap, quoted exactly as
 * Shortcuts shows it on this phone. The texts name the app being connected;
 * the pictures always show Instagram (or Tilo, the made-up app of the
 * custom-app steps). docs/ui-clarity-plan.md §4.5.
 */
function stepCopy(id: SetupStepId, app: string, readyActions: boolean): StepCopy {
  const example = EXAMPLE_APP.name;
  const fake = FAKE_APP.name;
  const inPicture = app === example ? "" : localize(` (${example} in the picture)`, ` (en la imagen, ${example})`);
  switch (id) {
    case "import_add":
      return {
        visual: "import",
        title: localize("Add the shortcut", "Añade el atajo"),
        body: localize(
          "Tap “Add to Shortcuts” below, then “Add Shortcut”. It already contains everything Still needs.",
          "Toca «Añadir a Atajos» aquí abajo y luego «Añadir atajo». Ya trae todo lo que Still necesita.",
        ),
        visualLabel: localize(
          "Image of the Add Shortcut sheet for Still - Pausa.",
          "Imagen de la hoja Añadir atajo para Still - Pausa.",
        ),
      };
    case "import_choose_apps":
      return {
        visual: "trigger-multi",
        title: localize("Choose the same apps", "Elige las mismas apps"),
        body: localize(
          "In the shortcut, tap the app list next to “When” and pick the apps you chose in Still.",
          "En el atajo, toca la lista de apps junto a «Cuando» y marca las apps que elegiste en Still.",
        ),
        visualLabel: localize(
          "Image of an automation trigger listing your chosen apps.",
          "Imagen de un disparador de automatización con tus apps elegidas.",
        ),
      };
    case "import_enable":
      return {
        visual: "toggle",
        title: localize("Turn it on", "Actívalo"),
        body: localize(
          "iOS adds shared automations switched off. Flip the switch at the top of the shortcut, then come back to Still.",
          "iOS añade las automatizaciones compartidas apagadas. Activa el interruptor de arriba del atajo y vuelve a Still.",
        ),
        visualLabel: localize(
          "Image of the automation switch turned on.",
          "Imagen del interruptor de la automatización activado.",
        ),
      };
    case "pick_app_trigger":
      return {
        title: localize(`Find ${q(sys("app"))}`, `Busca ${q(sys("app"))}`),
        body: localize(
          `Tap the picture to open a new automation in Shortcuts. Type ${sys("app")} in the search bar and tap ${sys("app")}.`,
          `Toca la imagen para abrir una automatización nueva en Atajos. Escribe ${sys("app")} en el buscador y toca ${sys("app")}.`,
        ),
        visualLabel: localize(
          `${sys("personalAutomation")} in Shortcuts, with ${sys("app")} typed in the search bar and the ${sys("app")} row marked.`,
          `${sys("personalAutomation")} en Atajos, con ${sys("app")} escrito en el buscador y la fila ${sys("app")} marcada.`,
        ),
      };
    case "tap_choose":
      return {
        title: localize(`Tap ${q(sys("choose"))}`, `Toca ${q(sys("choose"))}`),
        body: localize(
          `It's to the right of ${sys("app")}.`,
          `Está a la derecha de ${sys("app")}.`,
        ),
        visualLabel: localize(
          `The ${sys("when")} screen with ${sys("choose")} marked.`,
          `La pantalla ${sys("when")} con ${sys("choose")} marcado.`,
        ),
      };
    case "select_app":
      return {
        title: localize(`Check ${app}`, `Marca ${app}`),
        body: localize(
          `Check ${app}${inPicture} and tap the blue ✓.`,
          `Marca ${app}${inPicture} y toca el ✓ azul.`,
        ),
        visualLabel: localize(
          `${sys("chooseApp")} with ${example} checked and the blue check mark marked.`,
          `${sys("chooseApp")} con ${example} marcada y el ✓ azul marcado.`,
        ),
      };
    case "run_immediately":
      return {
        title: localize(
          `Tap ${q(sys("runImmediately"))}`,
          `Toca ${q(sys("runImmediately"))}`,
        ),
        body: localize(
          `So it runs by itself, without asking. Leave ${q(sys("notifyWhenRun"))} off and tap ${q(sys("next"))}.`,
          `Así se ejecuta sola, sin preguntarte. Deja ${q(sys("notifyWhenRun"))} apagado y toca ${q(sys("next"))}.`,
        ),
        visualLabel: localize(
          `${sys("runImmediately")}, the ${sys("notifyWhenRun")} switch and ${sys("next")}, marked in order.`,
          `${sys("runImmediately")}, el interruptor ${sys("notifyWhenRun")} y ${sys("next")}, marcados en orden.`,
        ),
      };
    case "create_new_shortcut":
      return {
        title: localize(
          `Tap ${q(sys("createNewShortcut"))}`,
          `Toca ${q(sys("createNewShortcut"))}`,
        ),
        body: localize("It's the first tile.", "Es el primer recuadro."),
        visualLabel: localize(
          `The ${sys("createNewShortcut")} tile marked.`,
          `El recuadro ${sys("createNewShortcut")} marcado.`,
        ),
      };
    case "search_actions":
      return {
        title: localize("Search for Still", "Busca Still"),
        body: localize(
          `Tap ${q(sys("searchActions"))} and type Still.`,
          `Toca ${q(sys("searchActions"))} y escribe Still.`,
        ),
        visualLabel: localize(
          `The editor with ${sys("searchActions")} marked.`,
          `El editor con ${sys("searchActions")} marcado.`,
        ),
      };
    case "add_still_action":
      return readyActions
        ? {
            title: localize(`Tap ${q(app)}`, `Toca ${q(app)}`),
            body: localize(
              `It's under ${q(sys("stillAction"))}, Still's action${inPicture}. It comes ready: “${sys("stillSummaryPrefix")} ${app}”, nothing to pick or type.`,
              `Está debajo de ${q(sys("stillAction"))}, la acción de Still${inPicture}. Viene lista: «${sys("stillSummaryPrefix")} ${app}», no hay que elegir ni escribir nada.`,
            ),
            visualLabel: localize(
              `Search results for Still: ${sys("stillAction")} with one tile per app, ${example} marked.`,
              `Resultados de Still: ${sys("stillAction")} con una ficha por app, ${example} marcada.`,
            ),
          }
        : {
            title: localize(`Tap ${q(sys("stillAction"))}`, `Toca ${q(sys("stillAction"))}`),
            body: localize(
              `Then tap ${q(sys("app"))} in it and choose ${app}.`,
              `Después toca ${q(sys("app"))} en la acción y elige ${app}.`,
            ),
            visualLabel: localize(
              `Search results for Still with ${sys("stillAction")} marked.`,
              `Resultados de Still con ${sys("stillAction")} marcada.`,
            ),
          };
    case "save_automation":
      return {
        title: localize("Save", "Guarda"),
        body: localize(
          `It should read “${sys("stillSummaryPrefix")} ${app}”. Tap the blue ✓, come back to Still and tap Test.`,
          `Tiene que decir «${sys("stillSummaryPrefix")} ${app}». Toca el ✓ azul, vuelve a Still y toca Probar.`,
        ),
        visualLabel: localize(
          `The finished automation, ${sys("stillSummaryPrefix")} ${example}, with the blue check mark marked.`,
          `La automatización terminada, ${sys("stillSummaryPrefix")} ${example}, con el ✓ azul marcado.`,
        ),
      };
    case "return_open_app":
      return {
        title: localize(
          `Create a shortcut with ${q(sys("openApp"))}`,
          `Crea un atajo con ${q(sys("openApp"))}`,
        ),
        body: localize(
          `Tap the picture to create a new shortcut and tap ${q(sys("openApp"))}.`,
          `Toca la imagen para crear un atajo nuevo y toca ${q(sys("openApp"))}.`,
        ),
        visualLabel: localize(
          `The action list with ${sys("openApp")} marked.`,
          `La lista de acciones con ${sys("openApp")} marcada.`,
        ),
      };
    case "return_choose_app":
      return {
        title: localize("Choose the app", "Elige la app"),
        body: localize(
          `Tap the blue ${q(sys("app"))} and choose ${fake}. Then tap the shortcut's name at the top.`,
          `Toca ${q(sys("app"))} (azul) y elige ${fake}. Después toca el nombre del atajo, arriba.`,
        ),
        visualLabel: localize(
          `The ${sys("openApp")} action with ${sys("app")} and the shortcut's name marked in order.`,
          `La acción ${sys("openApp")} con ${sys("app")} y el nombre del atajo marcados en orden.`,
        ),
      };
    case "return_rename":
      return {
        title: localize("Give it the exact name", "Ponle el nombre exacto"),
        body: localize(
          `Tap ${q(sys("rename"))} and type the name from the list below. The first time it runs, tap ${q(sys("alwaysAllow"))}.`,
          `Toca ${q(sys("rename"))} y escribe el nombre de la lista de abajo. La primera vez que se use, toca ${q(sys("alwaysAllow"))}.`,
        ),
        visualLabel: localize(
          `The shortcut's menu with ${sys("rename")} marked.`,
          `El menú del atajo con ${sys("rename")} marcado.`,
        ),
      };
  }
}

function linkLabel(link: GuideLink) {
  switch (link) {
    case "create_automation":
      return localize(
        "Tap to open this exact screen in Shortcuts",
        "Toca para abrir esta misma pantalla en Atajos",
      );
    case "create_shortcut":
      return localize(
        "Tap to start a new shortcut in Shortcuts",
        "Toca para empezar un atajo nuevo en Atajos",
      );
    case "automations":
      return localize(
        "Tap to open your automations in Shortcuts",
        "Toca para abrir tus automatizaciones en Atajos",
      );
    case "resume":
      return localize(
        "Tap to go back to Shortcuts where you left off",
        "Toca para volver a Atajos donde lo dejaste",
      );
  }
}

/** Opens a Shortcuts link, falling back to plain Shortcuts, then to its install sheet. */
export function useOpenShortcuts() {
  const sheet = useStillSheet();
  return async (url: string) => {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // Two of the jump links are undocumented; plain Shortcuts is the fallback.
    }
    try {
      if (url !== SHORTCUTS_APP_URL) {
        await Linking.openURL(SHORTCUTS_APP_URL);
        return;
      }
    } catch {
      // Shortcuts itself does not open: it was removed from this iPhone.
    }
    await offerShortcutsInstall(sheet);
  };
}

/**
 * The steps of a guide, each with Shortcuts' own screen drawn in code. Every
 * picture is a button that jumps to (or back to) Shortcuts.
 */
export function ShortcutGuide({
  steps,
  app,
  appNames,
  readyActions,
}: {
  steps: readonly GuideStep[];
  /** The app being connected, named in the texts. */
  app: string;
  appNames: string[];
  readyActions: boolean;
}) {
  const open = useOpenShortcuts();
  return (
    <View style={styles.steps}>
      {steps.map((step, index) => {
        const copy = stepCopy(step.id, app, readyActions);
        const Drawn = step.screen ? SHORTCUTS_SCREENS[step.screen] : null;
        return (
          <View key={step.id} style={styles.step}>
            <View style={styles.stepHeading}>
              <Mono>{String(index + 1).padStart(2, "0")}</Mono>
              <Heading style={styles.stepTitle}>{copy.title}</Heading>
            </View>
            <Body style={styles.stepBody}>{copy.body}</Body>
            {Drawn ? (
              <GuideCard
                accessibilityLabel={copy.visualLabel}
                actionLabel={linkLabel(step.link)}
                onPress={() => void open(guideLinkUrl(step.link))}
              >
                <Drawn />
              </GuideCard>
            ) : copy.visual ? (
              <ShortcutStepVisual
                accessibilityLabel={copy.visualLabel}
                appName={app}
                appNames={appNames}
                variant={copy.visual}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.fog },
  step: {
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  stepHeading: { flexDirection: "row", alignItems: "baseline", gap: spacing.md },
  stepTitle: { flex: 1, fontSize: 18, lineHeight: 22 },
  stepBody: { color: colors.graphiteSoft, fontSize: 14, lineHeight: 21 },
});
