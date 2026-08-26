
        document.addEventListener('DOMContentLoaded', async () => {
            let userData = null;
            let userBookings = [];

            function renderUserProfile(data) {
                userData = data;
                const fullName = data.name || data.full_name || 'MAXSHOW Member';
                const firstName = fullName.split(' ')[0] || fullName;
                const username = data.username ? `@${data.username}` : '@user';
                const email = data.email || '';
                const phone = data.phone || data.phone_number || 'Not provided';
                const initial = fullName.trim().charAt(0).toUpperCase() || 'M';

                const welcomeEl = document.getElementById('welcome-name');
                if (welcomeEl) welcomeEl.textContent = `Hello, ${firstName}`;
                const profUsernameEl = document.getElementById('profile-username');
                if (profUsernameEl) profUsernameEl.textContent = username;
                const profNameEl = document.getElementById('profile-name');
                if (profNameEl) profNameEl.textContent = fullName;
                const profEmailEl = document.getElementById('profile-email');
                if (profEmailEl) profEmailEl.textContent = email;
                const profPhoneEl = document.getElementById('profile-phone');
                if (profPhoneEl) profPhoneEl.textContent = phone;
                const profInitEl = document.getElementById('profile-initial');
                if (profInitEl) profInitEl.textContent = initial;
            }

            try {
                const res = await apiRequest('/api/auth/me');
                userData = res.user;
            } catch (authErr) {
                window.location.href = 'user.html';
                return;
            }

            if (!userData) {
                window.location.href = 'user.html';
                return;
            }

            renderUserProfile(userData);

            // Edit Profile Modal Handling
            const editModal = document.getElementById('edit-profile-modal');
            const openEditBtn = document.getElementById('open-edit-profile-btn');
            const closeEditBtn = document.getElementById('close-edit-modal-btn');
            const cancelEditBtn = document.getElementById('cancel-edit-modal-btn');
            const editForm = document.getElementById('edit-profile-form');
            const editErrorMsg = document.getElementById('edit-error-msg');

            function showEditModal() {
                if (!userData) return;
                document.getElementById('edit-fullname').value = userData.name || userData.full_name || '';
                document.getElementById('edit-username').value = userData.username || '';
                document.getElementById('edit-email').value = userData.email || '';
                const phoneVal = userData.phone || userData.phone_number || '';
                document.getElementById('edit-phone').value = (phoneVal && phoneVal !== 'Not provided') ? phoneVal : '';
                editErrorMsg.classList.add('hidden');
                editModal.classList.remove('hidden');
            }

            function hideEditModal() {
                editModal.classList.add('hidden');
            }

            openEditBtn?.addEventListener('click', showEditModal);
            closeEditBtn?.addEventListener('click', hideEditModal);
            cancelEditBtn?.addEventListener('click', hideEditModal);
            editModal?.addEventListener('click', (e) => {
                if (e.target === editModal) hideEditModal();
            });

            // Real-time phone number sanitization (numbers only)
            document.getElementById('edit-phone')?.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
            });

            // Real-time username sanitization
            document.getElementById('edit-username')?.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 30);
            });

            editForm?.addEventListener('submit', async (e) => {
                e.preventDefault();
                editErrorMsg.classList.add('hidden');

                const fullName = document.getElementById('edit-fullname').value.trim();
                const username = document.getElementById('edit-username').value.trim().toLowerCase();
                const email = document.getElementById('edit-email').value.trim().toLowerCase();
                const phone = document.getElementById('edit-phone').value.trim();

                if (phone.length !== 10) {
                    editErrorMsg.textContent = 'Please enter a valid 10-digit mobile number.';
                    editErrorMsg.classList.remove('hidden');
                    return;
                }

                const saveBtn = document.getElementById('save-profile-btn');
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';

                try {
                    const res = await apiRequest('/api/auth/profile', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            full_name: fullName,
                            username: username,
                            email: email,
                            mobile: phone,
                        }),
                    });

                    renderUserProfile(res.user);
                    hideEditModal();
                    showToast('Profile updated successfully! 🎉');
                } catch (err) {
                    editErrorMsg.textContent = err.message || 'Failed to update profile. Please try again.';
                    editErrorMsg.classList.remove('hidden');
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Changes';
                }
            });

            const modal = document.getElementById('booking-modal');
            const modalContent = document.getElementById('modal-booking-content');
            const modalEventLink = document.getElementById('modal-event-link');
            const closeModalBtn = document.getElementById('close-booking-modal');
            const modalCloseBtn = document.getElementById('modal-close-btn');

            function openBookingDetails(booking) {
                if (!booking) return;
                const totalAmount = Number(booking.total ?? booking.price ?? 0);
                const isFree = totalAmount === 0 || booking.payment_status === 'Free Entry' || booking.payment_id === 'FREE';
                const badgeBg = isFree ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
                const badgeText = isFree ? '🔵 Free Entry' : '🟢 Paid (Razorpay)';
                const bookingCode = booking.booking_id || `BKG-${booking.id}`;
                const eventCode = booking.event_id || 'N/A';
                const formattedDate = booking.created_at ? new Date(booking.created_at).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                }) : 'Recently booked';

                const attendeeName = (userData && (userData.name || userData.full_name)) || 'MAXSHOW Member';
                const attendeeUsername = (userData && userData.username) ? `@${userData.username}` : '';
                const attendeeEmail = (userData && userData.email) || '';
                const attendeePhone = (userData && (userData.phone || userData.phone_number)) || 'Not provided';

                modalContent.innerHTML = `
                    <!-- Event Overview Header -->
                    <div class="flex items-center gap-4 rounded-2xl bg-stone-50 p-4 dark:bg-[#101820] border border-stone-200/70 dark:border-slate-700/60">
                        ${booking.event_image ? `<img src="${escapeHtml(booking.event_image)}" alt="Cover" class="h-20 w-20 rounded-xl object-cover shrink-0">` : ''}
                        <div class="min-w-0 flex-1">
                            <span class="rounded-full ${badgeBg} px-2.5 py-0.5 text-xs font-black">${badgeText}</span>
                            <h3 class="mt-1.5 text-lg font-black text-ink dark:text-white line-clamp-1">${escapeHtml(booking.title || 'Event')}</h3>
                            <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-300 line-clamp-1">📍 ${escapeHtml(booking.location || '')}</p>
                            <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-300 font-semibold">🕒 ${escapeHtml(booking.time || '')}</p>
                        </div>
                    </div>

                    <!-- Unique IDs Section -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="rounded-2xl border border-stone-200 bg-white p-3.5 dark:border-slate-700 dark:bg-[#151f2b]">
                            <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Booking ID</p>
                            <p class="mt-1 font-mono text-sm font-black text-coral break-all">${escapeHtml(bookingCode)}</p>
                        </div>
                        <div class="rounded-2xl border border-stone-200 bg-white p-3.5 dark:border-slate-700 dark:bg-[#151f2b]">
                            <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Event ID</p>
                            <p class="mt-1 font-mono text-sm font-black text-ink dark:text-white break-all">${escapeHtml(eventCode)}</p>
                        </div>
                    </div>

                    <!-- Payment & Ticket Details -->
                    <div class="rounded-2xl border border-stone-200 bg-white p-4 dark:border-slate-700 dark:bg-[#151f2b] space-y-3">
                        <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Payment &amp; Reservation Details</p>
                        
                        <div class="flex items-center justify-between text-sm">
                            <span class="text-slate-500 dark:text-slate-400">Tickets Reserved</span>
                            <span class="font-black text-ink dark:text-white">${booking.tickets || 1} ticket${(booking.tickets || 1) === 1 ? '' : 's'}</span>
                        </div>

                        <div class="flex items-center justify-between text-sm">
                            <span class="text-slate-500 dark:text-slate-400">Total Amount</span>
                            <span class="text-base font-black text-coral">${isFree ? 'Free entry (₹0)' : formatPrice(totalAmount)}</span>
                        </div>

                        <div class="flex items-center justify-between text-sm">
                            <span class="text-slate-500 dark:text-slate-400">Payment Status</span>
                            <span class="font-bold text-ink dark:text-white">${isFree ? 'Free Registration' : 'Verified via Razorpay'}</span>
                        </div>

                        ${booking.payment_id && booking.payment_id !== 'FREE' ? `
                            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-t border-stone-100 pt-2.5 dark:border-slate-700 text-sm">
                                <span class="text-slate-500 dark:text-slate-400">Razorpay Payment ID</span>
                                <span class="font-mono text-xs font-black text-ink dark:text-white break-all">${escapeHtml(booking.payment_id)}</span>
                            </div>
                        ` : ''}

                        <div class="flex items-center justify-between border-t border-stone-100 pt-2.5 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                            <span>Booked Date</span>
                            <span class="font-semibold">${formattedDate}</span>
                        </div>
                    </div>

                    <!-- Customer Contact Info -->
                    <div class="rounded-2xl bg-cream/70 p-4 dark:bg-[#101820] text-xs space-y-1 text-slate-600 dark:text-slate-300">
                        <p class="font-bold text-ink dark:text-white">Attendee details</p>
                        <p>👤 <strong>${escapeHtml(attendeeName)}</strong> ${attendeeUsername ? `(${escapeHtml(attendeeUsername)})` : ''}</p>
                        <p>✉️ ${escapeHtml(attendeeEmail)} ${attendeePhone && attendeePhone !== 'Not provided' ? `· 📞 ${escapeHtml(attendeePhone)}` : ''}</p>
                    </div>
                `;

                if (booking.event_slug) {
                    modalEventLink.href = `event.html?event=${encodeURIComponent(booking.event_slug)}`;
                    modalEventLink.classList.remove('hidden');
                } else {
                    modalEventLink.classList.add('hidden');
                }

                modal.classList.remove('hidden');
            }

            function hideModal() {
                modal.classList.add('hidden');
            }

            closeModalBtn?.addEventListener('click', hideModal);
            modalCloseBtn?.addEventListener('click', hideModal);
            modal?.addEventListener('click', (e) => {
                if (e.target === modal) hideModal();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                    hideModal();
                }
            });

            try {
                const { bookings } = await apiRequest('/api/bookings');
                userBookings = Array.isArray(bookings) ? bookings : [];
                const tickets = userBookings.reduce((total, booking) => total + (booking.tickets || 0), 0);
                const countEl = document.getElementById('booking-count');
                if (countEl) countEl.textContent = `${tickets} ticket${tickets === 1 ? '' : 's'}`;

                const list = document.getElementById('booking-list');
                const emptyEl = document.getElementById('empty-bookings');

                if (!userBookings.length) {
                    if (emptyEl) emptyEl.classList.remove('hidden');
                    if (list) list.innerHTML = '';
                } else {
                    if (emptyEl) emptyEl.classList.add('hidden');
                    if (list) {
                        list.innerHTML = userBookings.map((booking, idx) => {
                            const isFree = booking.total === 0 || booking.payment_status === 'Free Entry';
                            const badgeBg = isFree ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
                            const badgeText = isFree ? '🔵 Free Entry' : '🟢 Paid (Razorpay)';

                            return `
                                <article data-booking-index="${idx}" class="group overflow-hidden rounded-3xl bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:border-coral/50 cursor-pointer dark:bg-[#1c2733] border border-stone-200 dark:border-slate-700">
                                    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                                        <div class="flex items-center gap-4">
                                            ${booking.event_image ? `<img src="${escapeHtml(booking.event_image)}" alt="Event cover" class="h-16 w-16 rounded-2xl object-cover shrink-0 group-hover:scale-105 transition duration-200">` : ''}
                                            <div>
                                                <div class="flex items-center gap-2">
                                                    <span class="rounded-full ${badgeBg} px-2.5 py-0.5 text-xs font-black">${badgeText}</span>
                                                </div>
                                                <h3 class="mt-1.5 text-lg font-black text-ink group-hover:text-coral transition dark:text-white">${escapeHtml(booking.title || 'Event')}</h3>
                                                <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-300">📍 ${escapeHtml(booking.location || '')} · 🕒 ${escapeHtml(booking.time || '')}</p>
                                            </div>
                                        </div>
                                        <div class="flex items-center justify-between sm:justify-end gap-5 border-t sm:border-t-0 pt-3 sm:pt-0 border-stone-100 dark:border-slate-700">
                                            <div class="text-left sm:text-right">
                                                <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Reserved</p>
                                                <p class="font-black text-ink dark:text-white text-base">${booking.tickets || 1} ticket${(booking.tickets || 1) === 1 ? '' : 's'}</p>
                                                <p class="text-sm font-black text-coral">${isFree ? 'Free' : formatPrice(booking.total)}</p>
                                            </div>
                                            <div class="grid h-9 w-9 place-items-center rounded-xl bg-stone-100 text-slate-500 group-hover:bg-coral group-hover:text-white transition dark:bg-slate-800 dark:text-slate-300">
                                                →
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            `;
                        }).join('');

                        list.querySelectorAll('[data-booking-index]').forEach(card => {
                            card.addEventListener('click', () => {
                                const index = Number(card.dataset.bookingIndex);
                                const booking = userBookings[index];
                                if (booking) openBookingDetails(booking);
                            });
                        });
                    }
                }
            } catch (err) {
                console.error('Failed to fetch bookings:', err);
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
                    const modal = document.getElementById('maxshow-confirm-modal');
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

            document.getElementById('logout-button')?.addEventListener('click', async () => {
                const confirmed = await showConfirmModal({
                    title: 'Log out of MAXSHOW?',
                    message: 'You will need to sign in again to access your account and booked tickets.',
                    icon: '🚪',
                    confirmText: 'Log out',
                    cancelText: 'Stay signed in',
                    type: 'logout',
                });
                if (!confirmed) return;
                try {
                    await apiRequest('/api/auth/logout', { method: 'POST' });
                } catch (_) {}
                window.location.href = 'index.html';
            });
        });
    