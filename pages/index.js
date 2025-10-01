import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    let deferredPrompt;

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;

      const btn = document.getElementById("installBtn");
      btn.style.display = "block";

      btn.addEventListener("click", async () => {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response: ${outcome}`);
        deferredPrompt = null;
        btn.style.display = "none";
      });
    });
  }, []);

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Welcome to My Next.js PWA</h1>
      <button
        id="installBtn"
        style={{ display: "none", padding: "10px 20px", fontSize: "16px" }}
      >
        Install App
      </button>
    </div>
  );
}
