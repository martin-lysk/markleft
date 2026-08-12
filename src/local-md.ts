import { isDevelopmentBuild } from "./constants";
import { start } from "./app";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void start(isDevelopmentBuild));
} else {
  void start(isDevelopmentBuild);
}

