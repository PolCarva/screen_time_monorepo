import type { ReactNode } from "react";

export const ANDROID_APK_PATH =
  "https://github.com/PolCarva/screen_time_monorepo/releases/download/android-beta-v0.1.0/still-android-beta-0.1.0-arm64.apk";

type AndroidDownloadLinkProps = {
  children?: ReactNode;
  className?: string;
};

export function AndroidDownloadLink({
  children = "Descargar APK",
  className = "button button--ink",
}: AndroidDownloadLinkProps) {
  return (
    <a
      className={className}
      href={ANDROID_APK_PATH}
      type="application/vnd.android.package-archive"
    >
      {children}
    </a>
  );
}
