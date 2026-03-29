document.addEventListener("DOMContentLoaded", () => {
    const authStatus = document.getElementById("auth-status");
    const dbStatus = document.getElementById("db-status");

    const checkHealth = async () => {
        try {
            const authRes = await fetch("/api/auth/health");
            const authText = await authRes.text();

            if (authRes.ok && authText === "ok") {
                authStatus.textContent = "Online 🟢";
            } else {
                throw new Error("Auth service returned bad status");
            }
        } catch (error) {
            console.error("Auth Health Error:", error);
            authStatus.textContent = "Offline 🔴";
        }

        try {
            const dbRes = await fetch("/api/db/health");
            const dbData = await dbRes.json();

            if (dbRes.ok && dbData.ok === true) {
                dbStatus.textContent = "Online 🟢";
            } else {
                throw new Error("DB service returned bad status");
            }
        } catch (error) {
            console.error("DB Health Error:", error);
            dbStatus.textContent = "Offline 🔴";
        }
    };

    checkHealth();
    setInterval(checkHealth, 5000);
});
