
        document.addEventListener('DOMContentLoaded', () => {
            let globalData = { stats: {}, users: [], events: [], all_bookings: [] };
            let activeTab = 'users'; // default active view: users
            let currentUserForModal = null;
            const fields = ['slug', 'title', 'type', 'venue', 'location', 'price', 'category', 'day', 'image', 'description'];
            const $ = id => document.getElementById(id);

            function showToast(message) {
                const toast = $('toast');
                if (!toast) return;
                toast.textContent = message;
                toast.classList.remove('hidden');
                setTimeout(() => toast.classList.add('hidden'), 3500);
            }

            function showConfirmModal({
                title = 'Confirm Action',
                message = 'Are you sure you want to proceed?',
                icon = '⚠️',
                confirmText = 'Confirm',
                cancelText = 'Cancel',
                type = 'danger',
            } = {}) {
                return new Promise((resolve) => {
                    const modal = $('maxshow-confirm-modal');
                    if (!modal) {
                        resolve(window.confirm(message));
                        return;
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
            }

            // View Switching via 4 Big Metric Cards
            const tabContents = {
                users: $('tab-users'),
                events: $('tab-events'),
                transactions: $('tab-transactions'),
            };

            const metricCards = {
                users: $('card-stat-users'),
                events: $('card-stat-events'),
                bookings: $('card-stat-bookings'),
                revenue: $('card-stat-revenue'),
            };

            function switchView(tabKey, extraFilter = null) {
                activeTab = tabKey;

                // Hide all sections, show active section
                Object.keys(tabContents).forEach(key => {
                    const el = tabContents[key];
                    if (!el) return;
                    if (key === tabKey) {
                        el.classList.remove('hidden');
                    } else {
                        el.classList.add('hidden');
                    }
                });

                // Update metric card active styles
                Object.keys(metricCards).forEach(key => {
                    const card = metricCards[key];
                    if (!card) return;
                    
                    const isSelected = (tabKey === 'users' && key === 'users') ||
                                       (tabKey === 'events' && key === 'events') ||
                                       (tabKey === 'transactions' && (extraFilter === 'paid' ? key === 'revenue' : key === 'bookings'));

                    if (isSelected) {
                        card.classList.add('border-coral', 'shadow-md', 'scale-[1.01]', 'bg-ink', 'text-white', 'dark:bg-[#1c2733]');
                        card.classList.remove('border-stone-200', 'bg-white', 'text-ink', 'dark:border-slate-700');
                    } else {
                        card.classList.remove('border-coral', 'shadow-md', 'scale-[1.01]', 'bg-ink', 'text-white');
                        card.classList.add('border-stone-200', 'bg-white', 'text-ink', 'dark:bg-[#1c2733]', 'dark:border-slate-700', 'dark:text-white');
                    }
                });

                // Auto-focus search input
                if (tabKey === 'users') {
                    $('search-users')?.focus();
                } else if (tabKey === 'events') {
                    $('search-events')?.focus();
                } else if (tabKey === 'transactions') {
                    if (extraFilter) {
                        if ($('filter-payment-status')) $('filter-payment-status').value = extraFilter;
                        renderTransactions(globalData.all_bookings || []);
                    }
                    $('search-transactions')?.focus();
                }
            }

            // Top Metric Cards Click Listeners
            $('card-stat-users')?.addEventListener('click', () => switchView('users'));
            $('card-stat-events')?.addEventListener('click', () => switchView('events'));
            $('card-stat-bookings')?.addEventListener('click', () => switchView('transactions', 'all'));
            $('card-stat-revenue')?.addEventListener('click', () => switchView('transactions', 'paid'));

            // Real-time Search & Filter Event Listeners
            $('search-users')?.addEventListener('input', () => {
                renderUsers(globalData.users || []);
            });

            $('search-events')?.addEventListener('input', () => {
                renderEvents(globalData.events || []);
            });

            $('filter-event-category')?.addEventListener('change', () => {
                renderEvents(globalData.events || []);
            });

            $('search-transactions')?.addEventListener('input', () => {
                renderTransactions(globalData.all_bookings || []);
            });

            $('filter-payment-status')?.addEventListener('change', () => {
                renderTransactions(globalData.all_bookings || []);
            });

            // Auto-generate slug from title
            $('event-title')?.addEventListener('input', (e) => {
                if (!$('event-id').value) {
                    $('event-slug').value = e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
                }
            });

            // Image Preview on file select
            $('event-image-file')?.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        $('image-preview').src = ev.target.result;
                        $('image-preview-name').textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
                        $('image-preview-container').classList.remove('hidden');
                    };
                    reader.readAsDataURL(file);
                }
            });

            // Event Editor Modal Controls
            function showEditorModal(event = null) {
                $('editor-modal').classList.remove('hidden');
                $('editor-title').textContent = event ? 'Edit Event' : 'Add New Event';
                $('event-message').classList.add('hidden');

                fields.forEach(field => {
                    const el = field === 'type' ? $('event-type') : $(`event-${field}`);
                    if (el) {
                        el.value = event ? (field === 'type' ? event.type : event[field]) : (field === 'day' ? 'weekend' : '');
                    }
                });

                if (event) {
                    const dateMatch = event.time?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
                    const clockMatch = event.time?.match(/\d{2}:\d{2}/)?.[0];
                    $('event-date').value = dateMatch || new Date().toISOString().slice(0, 10);
                    $('event-clock').value = clockMatch || '18:00';
                    $('event-image').value = event.image || '';
                    $('event-id').value = event.id || '';

                    if (event.image) {
                        $('image-preview').src = event.image;
                        $('image-preview-name').textContent = 'Current event image';
                        $('image-preview-container').classList.remove('hidden');
                    }
                } else {
                    $('event-date').value = new Date().toISOString().slice(0, 10);
                    $('event-clock').value = '19:30';
                    $('event-image').value = 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=85';
                    $('event-id').value = '';
                    $('image-preview').src = $('event-image').value;
                    $('image-preview-name').textContent = 'Default curated stock image';
                    $('image-preview-container').classList.remove('hidden');
                }
            }

            function hideEditorModal() {
                $('editor-modal').classList.add('hidden');
                $('event-image-file').value = '';
            }

            $('new-event-btn').onclick = () => showEditorModal();
            $('close-modal-btn').onclick = hideEditorModal;
            $('cancel-edit-btn').onclick = hideEditorModal;
            $('editor-modal')?.addEventListener('click', (e) => {
                if (e.target === $('editor-modal')) hideEditorModal();
            });

            // User Details & Bookings Modal Controls
            function showUserDetailsModal(user) {
                currentUserForModal = user;
                const modal = $('user-details-modal');
                if (!modal) return;

                const name = user.name || 'MAXSHOW User';
                const initial = name.trim().charAt(0).toUpperCase() || 'U';
                const userIdCode = user.user_id || `USR-${user.id}`;
                const usernameDisplay = user.username && user.username !== 'N/A' ? `@${user.username}` : '@user';
                const bookings = user.bookings || [];

                $('modal-user-avatar').textContent = initial;
                $('modal-user-name').textContent = name;
                $('modal-user-username').textContent = usernameDisplay;
                $('modal-user-id').textContent = userIdCode;
                
                const emailEl = $('modal-user-email');
                emailEl.textContent = user.email || 'N/A';
                emailEl.title = user.email || '';

                $('modal-user-phone').textContent = user.phone || 'Not provided';
                $('modal-user-bookings-stat').textContent = `${user.bookings_count || bookings.length} orders (${user.ticket_count || 0} tickets)`;
                $('modal-user-spent').textContent = formatPrice(user.total_spent || 0);
                $('modal-bookings-count').textContent = bookings.length;

                // Render User's Bookings
                const bookingsList = $('modal-user-bookings-list');
                if (bookings.length > 0) {
                    bookingsList.innerHTML = bookings.map(b => {
                        const isFree = b.total === 0 || b.payment_status === 'Free Entry';
                        const badgeBg = isFree ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
                        const badgeText = isFree ? '🔵 Free Entry' : '🟢 Paid (Razorpay)';
                        const bookingCode = b.booking_id || `BKG-${b.id}`;
                        const eventCode = b.event_code || 'N/A';

                        return `
                            <div class="overflow-hidden rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#101820] transition hover:shadow-md space-y-3.5">
                                <!-- Top Row: Identifiers and Status Pill -->
                                <div class="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3 dark:border-slate-800/80">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <span class="rounded-lg bg-cream px-2.5 py-1 font-mono text-xs font-bold text-slate-800 dark:bg-[#1c2733] dark:text-slate-200">
                                            Booking: <strong class="text-coral">${escapeHtml(bookingCode)}</strong>
                                        </span>
                                        <span class="rounded-lg bg-stone-100 px-2.5 py-1 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                            Event ID: ${escapeHtml(eventCode)}
                                        </span>
                                    </div>
                                    <span class="rounded-full ${badgeBg} px-3 py-0.5 text-xs font-black">${badgeText}</span>
                                </div>

                                <!-- Middle Row: Event Info -->
                                <div class="space-y-1">
                                    <h4 class="text-base sm:text-lg font-black text-ink dark:text-white leading-snug">${escapeHtml(b.title)}</h4>
                                    <p class="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                                        <span>📍 ${escapeHtml(b.location)}</span>
                                        <span>·</span>
                                        <span>🕒 ${escapeHtml(b.time)}</span>
                                    </p>
                                    ${b.payment_id && b.payment_id !== 'FREE' ? `
                                        <p class="font-mono text-[11px] text-slate-400 dark:text-slate-400 pt-0.5">
                                            Razorpay ID: <span class="font-bold text-coral">${escapeHtml(b.payment_id)}</span>
                                        </p>
                                    ` : ''}
                                </div>

                                <!-- Bottom Row: Tickets, Total & Delete Action Button -->
                                <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-100 dark:border-slate-800/80">
                                    <div class="flex items-center gap-2.5">
                                        <div class="rounded-xl bg-stone-100 px-3 py-1.5 dark:bg-slate-800">
                                            <span class="text-xs font-bold text-slate-700 dark:text-slate-300">🎟 <strong>${b.tickets}</strong> ticket${b.tickets > 1 ? 's' : ''}</span>
                                        </div>
                                        <div class="rounded-xl bg-coral/10 px-3 py-1.5 dark:bg-coral/20">
                                            <span class="text-xs font-black text-coral">Total: ${isFree ? 'Free' : formatPrice(b.total)}</span>
                                        </div>
                                    </div>
                                    <button class="delete-booking-btn flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-600 hover:text-white dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-600 dark:hover:text-white" data-booking-id="${b.id}" data-booking-code="${escapeHtml(bookingCode)}" data-event-title="${escapeHtml(b.title)}">
                                        <span>🗑 Delete Booking</span>
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('');
                } else {
                    bookingsList.innerHTML = `
                        <div class="rounded-2xl border border-dashed border-stone-200 p-8 text-center text-xs text-slate-400 dark:border-slate-800">
                            No tickets booked by this user yet.
                        </div>
                    `;
                }

                // Delete booking button event delegation inside modal
                bookingsList.querySelectorAll('.delete-booking-btn').forEach(btn => {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        const bId = btn.dataset.bookingId;
                        const bCode = btn.dataset.bookingCode;
                        const evTitle = btn.dataset.eventTitle;
                        deleteBookingAction(bId, bCode, evTitle);
                    };
                });

                // Modal Delete User Button
                $('modal-delete-user-btn').onclick = () => {
                    deleteUserAction(user.id, user.name);
                };

                modal.classList.remove('hidden');
            }

            function hideUserDetailsModal() {
                $('user-details-modal')?.classList.add('hidden');
                currentUserForModal = null;
            }

            $('close-user-modal-btn')?.addEventListener('click', hideUserDetailsModal);
            $('modal-close-user-footer-btn')?.addEventListener('click', hideUserDetailsModal);
            $('user-details-modal')?.addEventListener('click', (e) => {
                if (e.target === $('user-details-modal')) hideUserDetailsModal();
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    if (!$('editor-modal').classList.contains('hidden')) hideEditorModal();
                    if (!$('user-details-modal').classList.contains('hidden')) hideUserDetailsModal();
                }
            });

            // Load and Render All Dashboard Data
            async function loadDashboard() {
                try {
                    const data = await apiRequest('/api/admin/overview');
                    globalData = data;

                    // Update Top Stats Numbers
                    $('stat-users').textContent = data.stats.users;
                    $('stat-events').textContent = data.stats.events;
                    $('stat-bookings').textContent = data.stats.bookings;
                    $('stat-tickets-detail').textContent = `${data.stats.tickets || 0} tickets reserved`;
                    $('stat-revenue').textContent = formatPrice(data.stats.revenue || 0);
                    $('stat-payments-detail').textContent = `${data.stats.paid_bookings || 0} paid · ${data.stats.free_bookings || 0} free`;

                    // Update Badge Counts
                    if ($('users-count-badge')) $('users-count-badge').textContent = data.users.length;
                    if ($('events-count-badge')) $('events-count-badge').textContent = data.events.length;
                    if ($('bookings-count-badge')) $('bookings-count-badge').textContent = data.all_bookings?.length || data.stats.bookings;

                    // Render Sections
                    renderUsers(data.users);
                    renderEvents(data.events);
                    renderTransactions(data.all_bookings || []);

                    // If user modal was open, refresh it
                    if (currentUserForModal) {
                        const updatedUser = data.users.find(u => u.id === currentUserForModal.id);
                        if (updatedUser) {
                            showUserDetailsModal(updatedUser);
                        } else {
                            hideUserDetailsModal();
                        }
                    }
                } catch (err) {
                    showToast('Failed to load dashboard data');
                }
            }

            // Render Registered Users
            function renderUsers(users) {
                const query = ($('search-users')?.value || '').toLowerCase().trim();
                const filtered = users.filter(u => {
                    if (!query) return true;
                    return (u.name && u.name.toLowerCase().includes(query)) ||
                           (u.username && u.username.toLowerCase().includes(query)) ||
                           (u.email && u.email.toLowerCase().includes(query)) ||
                           (u.user_id && u.user_id.toLowerCase().includes(query)) ||
                           (u.phone && u.phone.toLowerCase().includes(query));
                });

                const container = $('users-container');
                const empty = $('users-empty');

                if (!filtered.length) {
                    container.innerHTML = '';
                    empty.classList.remove('hidden');
                    return;
                }

                empty.classList.add('hidden');
                container.innerHTML = filtered.map(user => {
                    const bookings = user.bookings || [];
                    const userIdCode = user.user_id || `USR-${user.id}`;
                    const initial = (user.name || 'U').trim().charAt(0).toUpperCase();

                    return `
                        <div class="user-card group cursor-pointer overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-coral/60 dark:border-slate-700 dark:bg-[#1c2733] flex flex-col justify-between gap-4" data-user-id="${user.id}">
                            <div class="flex items-center justify-between gap-3">
                                <div class="flex items-center gap-3.5 min-w-0">
                                    <div class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#F9D9B7] text-lg font-black text-ink shadow-sm">
                                        ${escapeHtml(initial)}
                                    </div>
                                    <div class="min-w-0">
                                        <h3 class="text-base font-black text-ink dark:text-white truncate group-hover:text-coral transition">${escapeHtml(user.name)}</h3>
                                        <span class="inline-flex items-center mt-1 rounded-full bg-cream px-2.5 py-0.5 font-mono text-[11px] font-bold text-slate-700 dark:bg-[#101820] dark:text-slate-300">
                                            ID: <strong class="text-coral ml-1">${escapeHtml(userIdCode)}</strong>
                                        </span>
                                    </div>
                                </div>
                                <button class="delete-user-card-btn shrink-0 rounded-xl border border-stone-200 bg-stone-50 p-2 text-xs font-bold text-slate-400 hover:border-red-300 hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:bg-[#101820] dark:hover:bg-red-950/40 dark:hover:text-red-300 transition" title="Delete User" data-user-id="${user.id}" data-user-name="${escapeHtml(user.name)}">
                                    🗑
                                </button>
                            </div>

                            <div class="flex items-center justify-between border-t border-stone-100 pt-3 text-xs dark:border-slate-800/80">
                                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    🎟 <strong>${user.bookings_count || bookings.length}</strong> booking${(user.bookings_count || bookings.length) === 1 ? '' : 's'}
                                </span>
                                <button class="view-user-btn rounded-xl bg-coral/10 px-3.5 py-1.5 text-xs font-bold text-coral group-hover:bg-coral group-hover:text-white transition" data-user-id="${user.id}">
                                    View Details →
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');

                // Click listeners on user cards
                container.querySelectorAll('.user-card').forEach(card => {
                    card.onclick = (e) => {
                        if (e.target.closest('.delete-user-card-btn')) return;
                        const uId = Number(card.dataset.userId);
                        const user = globalData.users.find(u => u.id === uId);
                        if (user) showUserDetailsModal(user);
                    };
                });

                container.querySelectorAll('.delete-user-card-btn').forEach(btn => {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        const uId = Number(btn.dataset.userId);
                        const uName = btn.dataset.userName;
                        deleteUserAction(uId, uName);
                    };
                });
            }

            // Render Events Catalogue
            function renderEvents(events) {
                const query = ($('search-events')?.value || '').toLowerCase().trim();
                const catFilter = $('filter-event-category')?.value || 'all';

                const filtered = events.filter(e => {
                    const matchQ = !query ||
                                   (e.title && e.title.toLowerCase().includes(query)) ||
                                   (e.venue && e.venue.toLowerCase().includes(query)) ||
                                   (e.location && e.location.toLowerCase().includes(query)) ||
                                   (e.custom_id && e.custom_id.toLowerCase().includes(query));
                    const matchCat = catFilter === 'all' || e.category === catFilter;
                    return matchQ && matchCat;
                });

                const grid = $('events-grid');
                const empty = $('events-empty');

                if (!filtered.length) {
                    grid.innerHTML = '';
                    empty.classList.remove('hidden');
                    return;
                }

                empty.classList.add('hidden');
                grid.innerHTML = filtered.map(e => `
                    <div class="flex flex-col justify-between overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-[#1c2733]">
                        <div>
                            <div class="relative h-44 w-full bg-stone-100 dark:bg-slate-800">
                                <img src="${escapeHtml(e.image)}" alt="${escapeHtml(e.title)}" class="h-full w-full object-cover" onerror="this.src='https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=85'">
                                <div class="absolute top-3 left-3 flex flex-wrap gap-1.5">
                                    <span class="rounded-full bg-ink/80 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">${escapeHtml(e.type)}</span>
                                    ${e.custom_id ? `<span class="rounded-full bg-coral/90 px-2.5 py-1 font-mono text-[11px] font-bold text-white backdrop-blur">ID: ${escapeHtml(e.custom_id)}</span>` : ''}
                                </div>
                                <span class="absolute top-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-black text-ink shadow dark:bg-[#1c2733]/90 dark:text-white">
                                    ${e.price === 0 ? 'Free' : formatPrice(e.price)}
                                </span>
                            </div>
                            <div class="p-5">
                                <h3 class="text-base font-black text-ink dark:text-white line-clamp-1">${escapeHtml(e.title)}</h3>
                                <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">📍 ${escapeHtml(e.venue)}</p>
                                <p class="text-xs text-slate-500 dark:text-slate-400">🕒 ${escapeHtml(e.time)}</p>
                                <p class="mt-2 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">${escapeHtml(e.description)}</p>
                            </div>
                        </div>

                        <div class="flex items-center justify-between border-t border-stone-100 bg-stone-50/60 p-4 dark:border-slate-700/60 dark:bg-[#101820]">
                            <span class="text-xs font-bold text-slate-500 dark:text-slate-400">
                                🎟 <strong>${e.tickets_sold || 0}</strong> tickets
                            </span>
                            <div class="flex gap-2">
                                <button class="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-stone-50 dark:border-slate-700 dark:bg-[#1c2733] dark:text-slate-200" data-edit-event="${e.id}">
                                    Edit
                                </button>
                                <button class="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300" data-delete-event="${e.id}">
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');

                grid.querySelectorAll('[data-edit-event]').forEach(btn => {
                    btn.onclick = () => {
                        const ev = globalData.events.find(e => e.id == btn.dataset.editEvent);
                        if (ev) showEditorModal(ev);
                    };
                });

                grid.querySelectorAll('[data-delete-event]').forEach(btn => {
                    btn.onclick = () => {
                        const ev = globalData.events.find(e => e.id == btn.dataset.deleteEvent);
                        deleteEventAction(btn.dataset.deleteEvent, ev ? ev.title : 'this event');
                    };
                });
            }

            // Render Transactions Ledger
            function renderTransactions(bookings) {
                const query = ($('search-transactions')?.value || '').toLowerCase().trim();
                const statusFilter = $('filter-payment-status')?.value || 'all';

                const filtered = bookings.filter(b => {
                    const matchQ = !query ||
                        (b.user_name && b.user_name.toLowerCase().includes(query)) ||
                        (b.username && b.username.toLowerCase().includes(query)) ||
                        (b.user_email && b.user_email.toLowerCase().includes(query)) ||
                        (b.booking_id && b.booking_id.toLowerCase().includes(query)) ||
                        (b.user_code && b.user_code.toLowerCase().includes(query)) ||
                        (b.event_code && b.event_code.toLowerCase().includes(query)) ||
                        (b.title && b.title.toLowerCase().includes(query)) ||
                        (b.payment_id && b.payment_id.toLowerCase().includes(query));

                    const isFree = b.total === 0 || b.payment_status === 'Free Entry';
                    let matchStatus = true;
                    if (statusFilter === 'paid') matchStatus = !isFree;
                    if (statusFilter === 'free') matchStatus = isFree;

                    return matchQ && matchStatus;
                });

                const tbody = $('transactions-table-body');
                const empty = $('transactions-empty');

                if (!filtered.length) {
                    tbody.innerHTML = '';
                    empty.classList.remove('hidden');
                    return;
                }

                empty.classList.add('hidden');
                tbody.innerHTML = filtered.map(b => {
                    const isFree = b.total === 0 || b.payment_status === 'Free Entry';
                    const badgeBg = isFree ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
                    const badgeText = isFree ? '🔵 Free Entry' : '🟢 Paid (Razorpay)';
                    const bookingCode = b.booking_id || `BKG-${b.id}`;
                    const userCode = b.user_code || `USR-${b.user_id}`;
                    const eventCode = b.event_code || 'N/A';
                    const usernameDisplay = b.username && b.username !== 'N/A' ? `@${b.username}` : '';

                    return `
                        <tr class="hover:bg-stone-50/70 dark:hover:bg-slate-800/40 transition">
                            <td class="p-4 font-mono font-black text-coral">${escapeHtml(bookingCode)}</td>
                            <td class="p-4">
                                <p class="font-black text-ink dark:text-white">${escapeHtml(b.user_name)}</p>
                                <div class="flex flex-wrap items-center gap-1 mt-0.5">
                                    ${usernameDisplay ? `<span class="inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">${escapeHtml(usernameDisplay)}</span>` : ''}
                                    <span class="inline-block rounded bg-cream px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 dark:bg-[#101820] dark:text-slate-300">
                                        ${escapeHtml(userCode)}
                                    </span>
                                </div>
                                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${escapeHtml(b.user_email)}</p>
                            </td>
                            <td class="p-4">
                                <p class="font-bold text-ink dark:text-white">${escapeHtml(b.title)}</p>
                                <span class="inline-block rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                    ID: ${escapeHtml(eventCode)}
                                </span>
                                <p class="text-xs text-slate-500 dark:text-slate-400">📍 ${escapeHtml(b.location)} · ${escapeHtml(b.time)}</p>
                            </td>
                            <td class="p-4 font-bold">${b.tickets}</td>
                            <td class="p-4 font-black text-coral">${isFree ? 'Free' : formatPrice(b.total)}</td>
                            <td class="p-4">
                                <span class="rounded-full ${badgeBg} px-2.5 py-1 text-xs font-black">${badgeText}</span>
                                ${b.payment_id && b.payment_id !== 'FREE' ? `<p class="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">${escapeHtml(b.payment_id)}</p>` : ''}
                            </td>
                            <td class="p-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                ${b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                            </td>
                            <td class="p-4 text-right">
                                <button class="delete-table-booking-btn rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300" data-booking-id="${b.id}" data-booking-code="${escapeHtml(bookingCode)}" data-event-title="${escapeHtml(b.title)}">
                                    Cancel
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');

                tbody.querySelectorAll('.delete-table-booking-btn').forEach(btn => {
                    btn.onclick = () => {
                        const bId = btn.dataset.bookingId;
                        const bCode = btn.dataset.bookingCode;
                        const evTitle = btn.dataset.eventTitle;
                        deleteBookingAction(bId, bCode, evTitle);
                    };
                });
            }

            // Delete Actions with Custom Themed Confirmation Dialogs
            async function deleteEventAction(id, eventTitle = 'this event') {
                const confirmed = await showConfirmModal({
                    title: 'Delete Event from Catalogue?',
                    message: `Are you sure you want to delete "${eventTitle}"? It will no longer be visible in the discovery feed.`,
                    icon: '📅',
                    confirmText: 'Delete Event',
                    cancelText: 'Keep Event',
                    type: 'danger',
                });
                if (!confirmed) return;
                try {
                    await apiRequest(`/api/admin/events/${id}`, { method: 'DELETE' });
                    showToast('Event deleted successfully.');
                    await loadDashboard();
                } catch (err) {
                    showToast(err.message || 'Failed to delete event');
                }
            }

            async function deleteUserAction(id, userName = 'this user') {
                const confirmed = await showConfirmModal({
                    title: 'Delete User Account?',
                    message: `Are you sure you want to permanently delete "${userName}" and cancel all their reservations? This action cannot be undone.`,
                    icon: '👤',
                    confirmText: 'Delete User',
                    cancelText: 'Keep User',
                    type: 'danger',
                });
                if (!confirmed) return;
                try {
                    await apiRequest(`/api/admin/users/${id}`, { method: 'DELETE' });
                    hideUserDetailsModal();
                    showToast('User and associated bookings deleted successfully.');
                    await loadDashboard();
                } catch (err) {
                    showToast(err.message || 'Failed to delete user');
                }
            }

            async function deleteBookingAction(id, bookingCode = '', eventTitle = 'this event') {
                const titleStr = bookingCode ? `Delete Booking ${bookingCode}?` : 'Cancel Ticket Booking?';
                const confirmed = await showConfirmModal({
                    title: titleStr,
                    message: `Are you sure you want to cancel and delete the reservation for "${eventTitle}"? This will cancel the attendee's tickets.`,
                    icon: '🎟',
                    confirmText: 'Delete Booking',
                    cancelText: 'Keep Booking',
                    type: 'danger',
                });
                if (!confirmed) return;
                try {
                    await apiRequest(`/api/admin/bookings/${id}`, { method: 'DELETE' });
                    showToast('Ticket booking deleted successfully.');
                    await loadDashboard();
                } catch (err) {
                    showToast(err.message || 'Failed to delete booking');
                }
            }

            // Form Submit Handler for Events
            $('event-form').onsubmit = async (e) => {
                e.preventDefault();
                const saveBtn = $('save-event-btn');
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';
                $('event-message').classList.add('hidden');

                const file = $('event-image-file').files[0];
                try {
                    if (file) {
                        const data = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result.split(',')[1]);
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                        });
                        const upload = await apiRequest('/api/admin/upload-image', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ filename: file.name, content_type: file.type, data }),
                        });
                        $('event-image').value = upload.url;
                    }

                    if (!$('event-image').value) {
                        throw new Error('Please upload an event image or choose a stock photo.');
                    }

                    const payload = Object.fromEntries(fields.map(field => [
                        field === 'type' ? 'event_type' : field,
                        $(field === 'type' ? 'event-type' : `event-${field}`).value
                    ]));

                    payload.time = `${$('event-date').value} ${$('event-clock').value}`;
                    payload.price = Number(payload.price) || 0;

                    const eventId = $('event-id').value;
                    await apiRequest(eventId ? `/api/admin/events/${eventId}` : '/api/admin/events', {
                        method: eventId ? 'PUT' : 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });

                    hideEditorModal();
                    showToast(eventId ? 'Event updated successfully' : '🎉 New event published!');
                    await loadDashboard();
                } catch (err) {
                    $('event-message').textContent = err.message || 'Failed to save event.';
                    $('event-message').classList.remove('hidden');
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Event';
                }
            };

            // Log Out Handler with Themed Confirmation
            $('logout').onclick = async () => {
                const confirmed = await showConfirmModal({
                    title: 'Log out of Admin Dashboard?',
                    message: 'Are you sure you want to end your current administrator session?',
                    icon: '🔒',
                    confirmText: 'Log out',
                    cancelText: 'Cancel',
                    type: 'logout',
                });
                if (!confirmed) return;
                await apiRequest('/api/admin/logout', { method: 'POST' }).catch(() => {});
                window.location.href = 'admin.html';
            };

            // Initial load with auth check
            apiRequest('/api/admin/overview').then((data) => {
                globalData = data;
                loadDashboard();
                switchView('users'); // Show registered users view by default
            }).catch(() => {
                window.location.href = 'admin.html';
            });
        });
    