document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const errorMessage = document.getElementById("errorMessage");
  const submitBtn = document.getElementById("submitBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    errorMessage.style.display = "none";
    submitBtn.textContent = "Verifying...";
    submitBtn.disabled = true;

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(data);

        if (data.accessToken) {
          console.log("🔑 Token found! Setting cookie.");
          document.cookie = `token=${data.accessToken}; path=/; max-age=86400`;

          window.location.href = "/dashboard";
        } else {
          console.warn(
            "⚠️ Warning: 'data.accessToken' is missing from response."
          );
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Invalid email or password.");
      }
    } catch (error) {
      console.error("Login error:", error);
      errorMessage.textContent =
        error.message === "Failed to fetch"
          ? "Could not connect to the authentication server."
          : error.message;
      errorMessage.style.display = "block";
    } finally {
      submitBtn.textContent = "Sign In";
      submitBtn.disabled = false;
    }
  });
});
