document.addEventListener('DOMContentLoaded', async () => {
    const accountAction = document.getElementById('account-action');
    if (!accountAction) return;
    try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) return;
        const { user } = await response.json();
        const initial = user.name.trim().charAt(0).toUpperCase();
        accountAction.innerHTML = `<a href="dashboard.html" class="grid h-11 w-11 place-items-center rounded-full bg-coral font-black text-white shadow-lg shadow-coral/25 transition hover:-translate-y-0.5" title="Open your dashboard" aria-label="Open ${user.name}'s dashboard">${initial}</a>`;
    } catch (_) {
        // The public homepage remains usable if the API is not running.
    }
});
