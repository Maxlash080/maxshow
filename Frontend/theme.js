(() => {
    const storageKey = 'maxshow-theme';
    const savedTheme = localStorage.getItem(storageKey);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const useDarkTheme = savedTheme ? savedTheme === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', useDarkTheme);

    document.addEventListener('DOMContentLoaded', () => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'theme-toggle';
        button.setAttribute('aria-label', 'Switch to dark theme');

        const updateButton = () => {
            const isDark = document.documentElement.classList.contains('dark');
            button.textContent = isDark ? '☀' : '☾';
            button.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
            button.title = isDark ? 'Light theme' : 'Dark theme';
        };

        button.addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem(storageKey, isDark ? 'dark' : 'light');
            updateButton();
        });

        const homeActionArea = document.querySelector('header .flex.items-center.gap-3');
        if (homeActionArea) homeActionArea.append(button);
        else {
            button.classList.add('theme-toggle--fixed');
            document.body.append(button);
        }
        updateButton();
    });
})();
