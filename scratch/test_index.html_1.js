
        document.addEventListener('DOMContentLoaded', () => {
            const modal = document.getElementById('booking-modal');
            const modalEvent = document.getElementById('modal-event');
            const eventGrid = document.getElementById('event-grid');
            const weekendGrid = document.getElementById('weekend-grid');

            // Initialize dynamic location dropdown menu
            initLocationSelector({
                buttonId: 'location-button',
                menuId: 'location-menu',
                labelId: 'location-label',
                locations: LOCATIONS,
            });

            // Render weekend picks
            if (weekendGrid && typeof WEEKEND_PICKS !== 'undefined') {
                weekendGrid.innerHTML = WEEKEND_PICKS.map(createWeekendCardHTML).join('');
            }

            // Render initial fallback events immediately
            if (eventGrid && typeof FALLBACK_EVENTS !== 'undefined') {
                eventGrid.innerHTML = Object.values(FALLBACK_EVENTS).map(createEventCardHTML).join('');
                bindEventCardClicks();
            }

            function bindEventCardClicks() {
                document.querySelectorAll('.event-card').forEach(card => {
                    const select = () => window.location.href = `event.html?event=${encodeURIComponent(card.dataset.event)}`;
                    card.onclick = select;
                    card.onkeydown = (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            select();
                        }
                    };
                });
            }

            function setFilter(filter) {
                const cards = [...document.querySelectorAll('.event-card')];
                let visible = 0;
                cards.forEach(card => {
                    const match = filter === 'all' || (filter === 'under-500' ? Number(card.dataset.price) < 500 : card.dataset.category === filter || card.dataset.day === filter || (filter === 'free' && Number(card.dataset.price) === 0));
                    card.classList.toggle('hidden', !match);
                    if (match) visible++;
                });
                document.getElementById('empty-state').classList.toggle('hidden', visible > 0);
                document.querySelectorAll('.filter-button').forEach(button => {
                    const active = button.dataset.filter === filter;
                    button.className = `filter-button whitespace-nowrap rounded-full px-4 py-2 ${active ? 'bg-ink text-white' : 'border border-stone-300 bg-white'}`;
                });
            }

            function openModal(eventName) {
                modalEvent.textContent = eventName;
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                document.getElementById('reserve-button').focus();
            }

            function closeModal() {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }

            document.getElementById('today-button')?.addEventListener('click', () => {
                document.getElementById('discover').scrollIntoView({ behavior: 'smooth' });
                setTimeout(() => setFilter('today'), 400);
            });

            document.querySelectorAll('.category-link').forEach(link => {
                link.addEventListener('click', () => {
                    setFilter(link.dataset.category);
                    document.getElementById('discover-title').textContent = `${link.querySelector('p').textContent} around you`;
                });
            });

            document.querySelectorAll('.filter-button').forEach(button => {
                button.addEventListener('click', () => setFilter(button.dataset.filter));
            });

            document.getElementById('close-modal')?.addEventListener('click', closeModal);
            document.getElementById('cancel-modal')?.addEventListener('click', closeModal);
            modal?.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });

            document.getElementById('reserve-button')?.addEventListener('click', () => {
                closeModal();
                showToast('Please sign in to complete your reservation.');
                setTimeout(() => window.location.href = 'user.html', 700);
            });

            // Fetch live events from API
            apiRequest('/api/events')
                .then(({ events }) => {
                    if (events && events.length) {
                        eventGrid.innerHTML = events.map(createEventCardHTML).join('');
                        bindEventCardClicks();
                        setFilter('all');
                    }
                })
                .catch(() => {});
        });
    