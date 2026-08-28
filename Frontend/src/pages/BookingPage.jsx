import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { apiRequest } from '../utils/api';
import { FALLBACK_EVENTS } from '../utils/constants';
import { formatPrice, formatEventTime } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const BookingPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const slug = searchParams.get('event') || 'moonlight-picnic';
  const quantity = Math.max(1, parseInt(searchParams.get('quantity') || '1', 10));

  const [event, setEvent] = useState(() => FALLBACK_EVENTS[slug] || Object.values(FALLBACK_EVENTS)[0]);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  // Guest inputs if unauthenticated
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');

  useEffect(() => {
    apiRequest(`/api/events/${encodeURIComponent(slug)}`)
      .then((data) => {
        if (data && data.event) {
          setEvent(data.event);
        }
      })
      .catch(() => {
        if (FALLBACK_EVENTS[slug]) {
          setEvent(FALLBACK_EVENTS[slug]);
        }
      })
      .finally(() => setLoadingEvent(false));
  }, [slug]);

  const unitPrice = Number(event.price) || 0;
  const totalPrice = unitPrice * quantity;
  const isFree = totalPrice === 0;
  const timeFormatted = formatEventTime(event.time || '', event.day);

  const handleConfirmBooking = async () => {
    if (!isAuthenticated && (!guestName.trim() || !guestEmail.trim())) {
      showToast('Please enter your name and email to proceed.');
      return;
    }

    setProcessing(true);

    const bookingPayload = {
      event_id: Number(event.id) || null,
      event_slug: slug,
      title: event.title || 'Event Booking',
      location: event.location || event.venue || 'Pune',
      time: event.time || 'TBA',
      price: unitPrice,
      quantity,
      guest_name: !isAuthenticated ? guestName.trim() : (user?.name || ''),
      guest_email: !isAuthenticated ? guestEmail.trim() : (user?.email || ''),
      guest_phone: user?.phone || '',
      name: !isAuthenticated ? guestName.trim() : (user?.name || ''),
      email: !isAuthenticated ? guestEmail.trim() : (user?.email || ''),
      phone: user?.phone || '',
    };

    // Free Ticket Flow
    if (isFree) {
      try {
        const res = await apiRequest('/api/payment/create-order', {
          method: 'POST',
          body: JSON.stringify(bookingPayload),
        });

        setConfirmedBooking({
          booking_code: res.booking_id || 'BKG-CONFIRMED',
          title: event.title,
          time: event.time,
          location: event.location || event.venue,
          tickets: quantity,
          total: 0,
        });
        showToast('Reservation confirmed! 🎉');
      } catch (err) {
        showToast(err.message || 'Failed to complete reservation');
      } finally {
        setProcessing(false);
      }
      return;
    }

    // Paid Ticket via Razorpay
    try {
      const orderData = await apiRequest('/api/payment/create-order', {
        method: 'POST',
        body: JSON.stringify(bookingPayload),
      });

      if (!window.Razorpay) {
        showToast('Payment system loading. Please try again in a moment.');
        setProcessing(false);
        return;
      }

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'MAXSHOW Events',
        description: `${quantity}x ${event.title}`,
        image: '/logo.png',
        order_id: orderData.order_id,
        prefill: {
          name: isAuthenticated ? user.name : guestName,
          email: isAuthenticated ? user.email : guestEmail,
          contact: user?.phone || '',
        },
        theme: {
          color: '#F2634E',
        },
        handler: async (response) => {
          try {
            const verifyRes = await apiRequest('/api/payment/verify', {
              method: 'POST',
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                ...bookingPayload,
              }),
            });

            setConfirmedBooking({
              booking_code: verifyRes.booking_id || 'BKG-PAID',
              title: event.title,
              time: event.time,
              location: event.location || event.venue,
              tickets: quantity,
              total: totalPrice,
              payment_id: response.razorpay_payment_id,
            });
            showToast('Payment verified & booking confirmed! 🎟️');
          } catch (vErr) {
            showToast(vErr.message || 'Payment verification failed');
          } finally {
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            showToast('Payment cancelled');
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      showToast(err.message || 'Failed to initiate checkout');
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream text-ink dark:bg-[#101820] dark:text-white flex flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-8 flex-1">
        {/* Success Confirmation View */}
        {confirmedBooking ? (
          <div className="rounded-[2.5rem] bg-white p-8 sm:p-12 text-center shadow-soft dark:bg-[#1c2733] border border-stone-200/80 dark:border-slate-700 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-emerald-100 text-4xl text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              ✓
            </div>
            <div>
              <span className="inline-block rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 px-3 py-1 text-xs font-black">
                Booking Confirmed
              </span>
              <h1 className="mt-3 text-3xl sm:text-4xl font-black text-ink dark:text-white">
                You're all set!
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 font-semibold">
                Your entry ticket has been issued and linked to your booking code.
              </p>
            </div>

            {/* QR Code */}
            <div className="p-4 bg-white rounded-3xl inline-block shadow-sm border border-stone-200">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  confirmedBooking.booking_code
                )}`}
                alt="Ticket QR Code"
                className="h-44 w-44 mx-auto"
              />
            </div>

            <div className="rounded-2xl bg-stone-50 dark:bg-[#151f2b] p-4 max-w-sm mx-auto text-xs space-y-1 text-left">
              <p className="font-mono text-sm font-black text-coral text-center mb-2">
                #{confirmedBooking.booking_code}
              </p>
              <p className="text-slate-500"><strong>Event:</strong> {confirmedBooking.title}</p>
              <p className="text-slate-500"><strong>Passes:</strong> {confirmedBooking.tickets} Ticket(s)</p>
              <p className="text-slate-500"><strong>Total Paid:</strong> {confirmedBooking.total === 0 ? 'Free Entry' : formatPrice(confirmedBooking.total)}</p>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
              <Link
                to="/dashboard"
                className="rounded-2xl bg-coral px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-[#df503c] transition"
              >
                View in Dashboard →
              </Link>
              <Link
                to="/"
                className="rounded-2xl border border-stone-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 hover:bg-stone-50 transition dark:border-slate-700 dark:bg-[#101820] dark:text-slate-300"
              >
                Back to Home
              </Link>
            </div>
          </div>
        ) : (
          /* Checkout Summary & Confirmation */
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
            {/* Left: Booking Details Form */}
            <div className="space-y-6">
              <div className="rounded-[2.5rem] bg-white p-6 sm:p-8 shadow-soft dark:bg-[#1c2733] border border-stone-200/80 dark:border-slate-700 space-y-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-coral">Attendee Information</p>
                  <h2 className="mt-1 text-2xl font-black text-ink dark:text-white">Ticket Holder</h2>
                </div>

                {isAuthenticated ? (
                  <div className="flex items-center gap-3.5 rounded-2xl bg-stone-50 p-4 dark:bg-[#151f2b] border border-stone-200 dark:border-slate-700">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-coral text-base font-black text-white">
                      {user?.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-ink dark:text-white">{user?.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {user?.email} {user?.phone ? `· ${user?.phone}` : ''}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-ink dark:text-slate-200">Full Name *</label>
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-ink dark:text-slate-200">Email Address *</label>
                      <input
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="For digital QR tickets"
                        className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-coral dark:border-slate-700 dark:bg-[#101820] dark:text-white"
                        required
                      />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Already have an account?{' '}
                      <Link to={`/user?redirect=/booking?event=${slug}&quantity=${quantity}`} className="font-bold text-coral hover:underline">
                        Sign in to sync your ticket
                      </Link>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Order Summary Card */}
            <div className="space-y-6">
              <div className="rounded-[2.5rem] bg-white p-6 sm:p-8 shadow-soft dark:bg-[#1c2733] border border-stone-200/80 dark:border-slate-700 space-y-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-coral">Order Summary</p>
                  <h3 className="mt-1 text-2xl font-black text-ink dark:text-white">{event.title}</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    📍 {event.venue || event.location} {timeFormatted ? `· 🕒 ${timeFormatted}` : ''}
                  </p>
                </div>

                <div className="space-y-3 border-t border-stone-100 pt-4 dark:border-slate-700 text-xs sm:text-sm">
                  <div className="flex justify-between font-semibold text-slate-600 dark:text-slate-300">
                    <span>Ticket Quantity</span>
                    <span>{quantity}x pass{quantity > 1 ? 'es' : ''}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-slate-600 dark:text-slate-300">
                    <span>Price per ticket</span>
                    <span>{formatPrice(unitPrice)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-slate-600 dark:text-slate-300">
                    <span>Booking Fee</span>
                    <span className="text-emerald-600 dark:text-emerald-400">₹0 (Waived)</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-ink dark:text-white pt-3 border-t border-stone-100 dark:border-slate-700">
                    <span>Total</span>
                    <span className="text-coral">{isFree ? 'Free Entry' : formatPrice(totalPrice)}</span>
                  </div>
                </div>

                <button
                  disabled={processing}
                  onClick={handleConfirmBooking}
                  className="w-full rounded-2xl bg-coral py-3.5 text-base font-bold text-white shadow-lg shadow-coral/25 transition hover:bg-[#df503c] disabled:opacity-50"
                >
                  {processing
                    ? 'Processing Order...'
                    : isFree
                    ? 'Confirm Free Pass →'
                    : `Pay ${formatPrice(totalPrice)} with Razorpay →`}
                </button>

                <p className="text-center text-[11px] text-slate-400">
                  🔒 Verified &amp; Secured with 256-bit SSL encryption.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};
