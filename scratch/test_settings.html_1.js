
        document.addEventListener('DOMContentLoaded', async () => {
            let userData = null;

            function showToast(message) {
                const toast = document.getElementById('toast');
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

            // Populate user details
            const fullName = userData.name || userData.full_name || 'MAXSHOW Member';
            const username = userData.username ? `@${userData.username}` : '@user';
            const email = userData.email || 'N/A';
            const phone = userData.phone || userData.phone_number || 'Not provided';
            const customUserId = userData.custom_id || `USR-${userData.id}`;
            const initial = fullName.trim().charAt(0).toUpperCase() || 'U';

            document.getElementById('settings-avatar').textContent = initial;
            document.getElementById('settings-fullname').textContent = fullName;
            document.getElementById('settings-username').textContent = username;
            document.getElementById('settings-email').textContent = email;
            document.getElementById('settings-phone').textContent = phone;

            // Delete Account Action
            document.getElementById('delete-account-btn')?.addEventListener('click', async () => {
                const confirmed = await showConfirmModal({
                    title: 'Permanently Delete Account?',
                    message: 'Are you sure you want to delete your MAXSHOW account? All your booked tickets and reservations will be cancelled immediately. This action cannot be undone.',
                    icon: '⚠️',
                    confirmText: 'Delete My Account',
                    cancelText: 'Keep Account',
                    type: 'danger',
                });
                if (!confirmed) return;

                const deleteBtn = document.getElementById('delete-account-btn');
                deleteBtn.disabled = true;
                deleteBtn.textContent = 'Deleting...';

                try {
                    await apiRequest('/api/auth/delete-account', { method: 'DELETE' });
                    window.location.href = 'index.html';
                } catch (err) {
                    showToast(err.message || 'Failed to delete account.');
                    deleteBtn.disabled = false;
                    deleteBtn.textContent = '🗑 Delete Account';
                }
            });

            // Logout Action
            document.getElementById('logout-button')?.addEventListener('click', async () => {
                const confirmed = await showConfirmModal({
                    title: 'Log out of MAXSHOW?',
                    message: 'You will need to sign in again to access your account.',
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
    