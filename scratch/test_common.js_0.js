/**
 * MAXSHOW Shared Utilities & Component Renderers
 * Centralizes data, UI renderers, API helpers, and formatting utilities
 * without altering visual appearance or functionality.
 */

// Available cities / locations
const LOCATIONS = [
    'Pimpri',
    'Chinchwad',
    'Hinjawadi',
    'Punawale',
    'Kasarwadi',
    'Nigdi',
    'Aundh',
];

// Fallback seed events for offline / immediate rendering
const FALLBACK_EVENTS = {
    'blue-room': {
        slug: 'blue-room',
        title: 'Blue room: acoustic night',
        type: 'Live music',
        venue: 'The Blue Room · Kasarwadi',
        time: 'Friday, 7:30 PM',
        location: 'Kasarwadi, Pimpri-Chinchwad',
        price: 399,
        image: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=85',
        description: 'Settle into an intimate evening of unplugged originals, soft lights, and a carefully curated local line-up. Come early, grab a seat, and discover a new favourite voice.',
        category: 'music',
        day: 'today',
    },
    'comedy-room': {
        slug: 'comedy-room',
        title: 'After hours: a comedy room',
        type: 'Comedy',
        venue: 'Laugh Lane · Nigdi',
        time: 'Saturday, 8:00 PM',
        location: 'Nigdi, Pimpri-Chinchwad',
        price: 299,
        image: 'https://images.unsplash.com/photo-1511988617509-a57c8a288659?auto=format&fit=crop&w=1200&q=85',
        description: 'A relaxed late-night set featuring sharp new comics and seasoned crowd favourites. Bring friends, enjoy the room, and expect a few surprises.',
        category: 'comedy',
        day: 'weekend',
    },
    'watercolour': {
        slug: 'watercolour',
        title: 'Watercolour in the park',
        type: 'Creative workshop',
        venue: 'Open Studio · Aundh',
        time: 'Sunday, 11:00 AM',
        location: 'Aundh, Pune',
        price: 450,
        image: 'https://images.unsplash.com/photo-1545987796-200677ee1011?auto=format&fit=crop&w=1200&q=85',
        description: 'A slow Sunday workshop for beginners and curious painters. Materials, guidance, and a warm cup of chai are included—just bring your favourite idea.',
        category: 'create',
        day: 'weekend',
    },
    'rooftop-cinema': {
        slug: 'rooftop-cinema',
        title: 'Rooftop cinema club',
        type: 'Film & outdoors',
        venue: 'Skyline Terrace · Hinjawadi',
        time: 'Sunday, 6:30 PM',
        location: 'Hinjawadi, Pune',
        price: 550,
        image: 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85',
        description: 'A classic film under an open sky, paired with soft blankets and cinema snacks. Arrive before sunset to settle in and catch the golden-hour view.',
        category: 'outdoors',
        day: 'weekend',
    },
    'brunch-social': {
        slug: 'brunch-social',
        title: 'Sunday brunch social',
        type: 'Food & drinks',
        venue: 'Common Table · Pimpri',
        time: 'Sunday, 12:30 PM',
        location: 'Pimpri, Pune',
        price: 599,
        image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=85',
        description: 'A leisurely afternoon meal designed for good conversation and new connections. Your ticket includes a shared seasonal menu and a welcome drink.',
        category: 'food',
        day: 'weekend',
    },
    'sunrise-run': {
        slug: 'sunrise-run',
        title: 'Community sunrise run',
        type: 'Move',
        venue: 'Riverside Track · Punawale',
        time: 'Sunday, 6:00 AM',
        location: 'Punawale, Pune',
        price: 0,
        image: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1200&q=85',
        description: 'Start the day with an easy, all-level community run. No pace pressure—just fresh air, friendly faces, and a stretch session after the finish.',
        category: 'move',
        day: 'today',
    },
};

const WEEKEND_PICKS = [
    {
        title: 'Garden sessions: Indie sundown',
        time: 'Sat, 24 Aug · 7 PM',
        location: 'Pimpri',
        price: 'from ₹799',
        image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
        imageAlt: 'Concert crowd',
    },
    {
        title: 'A long-table lunch',
        time: 'Sun, 25 Aug · 12 PM',
        location: 'Chinchwad',
        price: 'from ₹1,200',
        image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=800&q=80',
        imageAlt: 'Friends having dinner',
    },
    {
        title: 'Clay & chai: pottery studio',
        time: 'Sun, 25 Aug · 4 PM',
        location: 'Punawale',
        price: 'from ₹650',
        image: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80',
        imageAlt: 'Creative workshop',
    },
];

// Formatting Utilities
const escapeHtml = (value) => {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
    }[char] || char));
};

const formatPrice = (price) => {
    const num = Number(price);
    if (isNaN(num) || num === 0) return 'Free entry';
    return `₹${num.toLocaleString('en-IN')}`;
};

const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});

// Toast System
let _toastTimer = null;
const showToast = (message, duration = 2800) => {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.setAttribute('role', 'status');
        toast.className = 'fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-soft';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
        toast.classList.add('hidden');
    }, duration);
};

// Custom Themed Confirmation Modal
window.showConfirmModal = ({
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    icon = '⚠️',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'danger', // 'danger' | 'logout' | 'primary'
} = {}) => {
    return new Promise((resolve) => {
        let modal = document.getElementById('maxshow-confirm-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'maxshow-confirm-modal';
            modal.className = 'fixed inset-0 z-[100] hidden bg-ink/75 backdrop-blur-sm p-4 flex items-center justify-center';
            modal.innerHTML = `
                <div class="relative w-full max-w-md rounded-[2.5rem] bg-white p-6 sm:p-8 shadow-2xl dark:bg-[#1c2733] border border-stone-200 dark:border-slate-700 text-center animate-in fade-in zoom-in-95 duration-150">
                    <div id="confirm-modal-icon-container" class="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-100 text-3xl dark:bg-red-950/60 text-red-600 dark:text-red-400 shadow-sm">
                        <span id="confirm-modal-icon">🗑</span>
                    </div>
                    <h3 id="confirm-modal-title" class="mt-5 text-xl sm:text-2xl font-black text-ink dark:text-white">Confirm Action</h3>
                    <p id="confirm-modal-message" class="mt-2.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">Are you sure?</p>
                    <div class="mt-7 flex flex-col-reverse sm:flex-row gap-3">
                        <button id="confirm-modal-cancel" type="button" class="w-full rounded-2xl border border-stone-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-stone-50 dark:border-slate-700 dark:bg-[#101820] dark:text-slate-300 dark:hover:bg-slate-800">
                            Cancel
                        </button>
                        <button id="confirm-modal-ok" type="button" class="w-full rounded-2xl bg-coral px-5 py-3 text-sm font-bold text-white shadow-lg shadow-coral/25 transition hover:bg-[#df503c]">
                            Confirm
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const iconEl = modal.querySelector('#confirm-modal-icon');
        const iconContainer = modal.querySelector('#confirm-modal-icon-container');
        const titleEl = modal.querySelector('#confirm-modal-title');
        const messageEl = modal.querySelector('#confirm-modal-message');
        const cancelBtn = modal.querySelector('#confirm-modal-cancel');
        const okBtn = modal.querySelector('#confirm-modal-ok');

        iconEl.textContent = icon;
        titleEl.textContent = title;
        messageEl.textContent = message;
        cancelBtn.textContent = cancelText;
        okBtn.textContent = confirmText;

        if (type === 'danger') {
            iconContainer.className = 'mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-100 text-3xl dark:bg-red-950/60 text-red-600 dark:text-red-400 shadow-sm';
            okBtn.className = 'w-full rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/25 transition hover:bg-red-700';
        } else if (type === 'logout') {
            iconContainer.className = 'mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-coral/10 text-3xl text-coral dark:bg-coral/20 shadow-sm';
            okBtn.className = 'w-full rounded-2xl bg-coral px-5 py-3 text-sm font-bold text-white shadow-lg shadow-coral/25 transition hover:bg-[#df503c]';
        } else {
            iconContainer.className = 'mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-coral/10 text-3xl text-coral dark:bg-coral/20 shadow-sm';
            okBtn.className = 'w-full rounded-2xl bg-coral px-5 py-3 text-sm font-bold text-white shadow-lg shadow-coral/25 transition hover:bg-[#df503c]';
        }

        modal.classList.remove('hidden');

        function cleanup(result) {
            modal.classList.add('hidden');
            cancelBtn.onclick = null;
            okBtn.onclick = null;
            document.removeEventListener('keydown', keyHandler);
            modal.onclick = null;
            resolve(result);
        }

        function keyHandler(e) {
            if (e.key === 'Escape') cleanup(false);
        }

        cancelBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            cleanup(false);
        };
        okBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            cleanup(true);
        };
        modal.onclick = (e) => {
            if (e.target === modal) cleanup(false);
        };
        document.addEventListener('keydown', keyHandler);
    });
};
window.showConfirmModal = window.showConfirmModal;

// Universal Modal Scroll Lock Manager
window.lockBodyScroll = () => {
    document.body.style.overflow = 'hidden';
};

window.unlockBodyScroll = () => {
    // Check if any actual modal overlays are still visible
    const openModals = document.querySelectorAll(
        '#booking-modal:not(.hidden), #user-details-modal:not(.hidden), #editor-modal:not(.hidden), #edit-profile-modal:not(.hidden), #maxshow-confirm-modal:not(.hidden)'
    );
    if (openModals.length === 0) {
        document.body.style.overflow = '';
    }
};

// Safe modal observer that only targets specific known modal IDs
(() => {
    const modalIds = ['booking-modal', 'user-details-modal', 'editor-modal', 'edit-profile-modal', 'maxshow-confirm-modal'];
    
    function checkModals() {
        let isAnyOpen = false;
        for (const id of modalIds) {
            const el = document.getElementById(id);
            if (el && !el.classList.contains('hidden')) {
                isAnyOpen = true;
                break;
            }
        }
        if (isAnyOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initObserver);
    } else {
        initObserver();
    }

    function initObserver() {
        checkModals();
        const observer = new MutationObserver(() => {
            checkModals();
        });
        observer.observe(document.body, {
            attributes: true,
            subtree: true,
            attributeFilter: ['class'],
        });
    }
})();

// API Request Wrapper
const apiRequest = async (url, options = {}) => {
    const defaultHeaders = {
        'Accept': 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    };
    const response = await fetch(url, {
        credentials: 'same-origin',
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        if (response.status === 405) {
            throw new Error('Method not allowed (405). Please ensure the backend server has been restarted with the latest code.');
        }
        throw new Error(data.detail || data.message || `Request failed (${response.status}).`);
    }
    return data;
};

// Component Generator: Location Selector Dropdown
const initLocationSelector = ({
    buttonId = 'location-button',
    menuId = 'location-menu',
    labelId = 'location-label',
    locations = LOCATIONS,
    onSelect = null,
} = {}) => {
    const button = document.getElementById(buttonId);
    const menu = document.getElementById(menuId);
    const label = document.getElementById(labelId);

    if (!menu) return;

    // Render location options dynamically
    menu.innerHTML = locations.map(loc => `
        <button class="location-option w-full rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-cream dark:text-white dark:hover:bg-[#283747]" type="button">
            ${escapeHtml(loc)}
        </button>
    `).join('');

    // Toggle dropdown
    if (button) {
        button.onclick = (e) => {
            e.stopPropagation();
            const isHidden = menu.classList.toggle('hidden');
            button.setAttribute('aria-expanded', String(!isHidden));
        };
    }

    // Option click handling
    menu.querySelectorAll('.location-option').forEach(option => {
        option.onclick = () => {
            const locName = option.textContent.trim();
            if (label) label.textContent = locName;
            menu.classList.add('hidden');
            if (button) button.setAttribute('aria-expanded', 'false');
            showToast(`Showing events near ${locName}`);
            if (typeof onSelect === 'function') onSelect(locName);
        };
    });

    // Close on click outside
    document.addEventListener('click', (event) => {
        if (button && !button.contains(event.target) && !menu.contains(event.target)) {
            menu.classList.add('hidden');
            button.setAttribute('aria-expanded', 'false');
        }
    });
};

// Component Generator: Event Card for Home Grid
const createEventCardHTML = (event) => {
    const slug = escapeHtml(event.slug || event.id);
    const category = escapeHtml(event.category || 'other');
    const price = Number(event.price) || 0;
    const day = escapeHtml(event.day || 'weekend');
    const title = escapeHtml(event.title);
    const type = escapeHtml(event.type || event.event_type || '');
    const time = escapeHtml(event.time || '');
    const location = escapeHtml(event.location || '');
    const image = escapeHtml(event.image || '');
    const priceText = formatPrice(price);

    return `
        <article data-event="${slug}" data-category="${category}" data-price="${price}" data-day="${day}" tabindex="0" role="link" class="event-card cursor-pointer rounded-3xl transition hover:-translate-y-1 hover:shadow-soft">
            <img class="h-60 w-full rounded-3xl object-cover" src="${image}" alt="${title}">
            <p class="mt-4 text-xs font-bold uppercase tracking-wider text-coral">${type} · ${time}</p>
            <h3 class="mt-1 font-black">${title}</h3>
            <p class="mt-1 text-sm text-slate-500">${location} · ${priceText}</p>
        </article>
    `.trim();
};

// Component Generator: Weekend Picks Card
const createWeekendCardHTML = (pick) => {
    return `
        <article class="overflow-hidden rounded-3xl bg-white text-ink">
            <img class="h-52 w-full object-cover" src="${escapeHtml(pick.image)}" alt="${escapeHtml(pick.imageAlt || pick.title)}">
            <div class="p-5">
                <p class="text-xs font-bold uppercase tracking-wider text-coral">${escapeHtml(pick.time)}</p>
                <h3 class="mt-2 text-xl font-black">${escapeHtml(pick.title)}</h3>
                <p class="mt-2 text-sm text-slate-500">${escapeHtml(pick.location)} · ${escapeHtml(pick.price)}</p>
            </div>
        </article>
    `.trim();
};

// Component Generator: All Events Page Card
const createAllEventsCardHTML = (event) => {
    const slug = encodeURIComponent(event.slug || event.id);
    const category = escapeHtml(event.category || 'other');
    const title = escapeHtml(event.title);
    const type = escapeHtml(event.type || event.event_type || '');
    const time = escapeHtml(event.time || '');
    const location = escapeHtml(event.location || '');
    const image = escapeHtml(event.image || '');
    const priceText = formatPrice(event.price);

    return `
        <a data-category="${category}" href="event.html?event=${slug}" class="event overflow-hidden rounded-3xl bg-white transition hover:-translate-y-1 hover:shadow-xl">
            <img class="h-52 w-full object-cover" src="${image}" alt="${title}">
            <div class="p-5">
                <p class="text-xs font-bold uppercase tracking-wider text-coral">${type} · ${time}</p>
                <h2 class="mt-2 text-lg font-black">${title}</h2>
                <p class="mt-2 text-sm text-slate-500">${location} · ${priceText}</p>
            </div>
        </a>
    `.trim();
};

// Global Account Navigation State Manager
const initAccountNav = async () => {
    const accountAction = document.getElementById('account-action');
    if (!accountAction) return;

    try {
        const { user } = await apiRequest('/api/auth/me');
        if (user && user.name) {
            const initial = user.name.trim().charAt(0).toUpperCase() || 'U';
            const firstName = user.name.trim().split(' ')[0] || 'Profile';
            accountAction.innerHTML = `
                <a href="dashboard.html" class="flex items-center gap-2 rounded-full border border-stone-300 bg-white py-1.5 pl-2 pr-3 text-sm font-bold shadow-sm transition hover:border-coral hover:text-coral dark:border-slate-700 dark:bg-[#1c2733] dark:text-white" title="Open your profile dashboard" aria-label="Open ${escapeHtml(user.name)}'s dashboard">
                    <span class="grid h-7 w-7 place-items-center rounded-full bg-coral text-xs font-black text-white">${initial}</span>
                    <span class="max-w-[110px] truncate">${escapeHtml(firstName)}</span>
                </a>
            `;
            return;
        }
    } catch (_) {
        // Not signed in
    }

    if (!accountAction.innerHTML.trim()) {
        accountAction.innerHTML = `
            <a href="user.html" class="rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white transition hover:bg-coral dark:bg-[#283747] dark:text-white">Sign in</a>
        `;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initAccountNav();
});

