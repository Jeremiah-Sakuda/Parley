import { useState } from "react";
import { applyTheme, getStoredTheme, type Theme } from "../utils/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());

  function select(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      <button
        type="button"
        className={theme === "dark" ? "active" : ""}
        onClick={() => select("dark")}
      >
        DARK
      </button>
      <button
        type="button"
        className={theme === "light" ? "active" : ""}
        onClick={() => select("light")}
      >
        LIGHT
      </button>
    </div>
  );
}
