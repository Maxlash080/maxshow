import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { apiRequest } from '../utils/api';
import { FALLBACK_EVENTS } from '../utils/constants';
import { formatPrice, formatEventTime } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { loadRazorpay } from '../utils/razorpay';

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

  // If user is not authenticated, redirect directly to Login page with redirect back
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      const redirectTarget = `/booking?event=${encodeURIComponent(slug)}&quantity=${quantity}`;
      showToast('Please sign in to book tickets.');
      navigate(`/user?redirect=${encodeURIComponent(redirectTarget)}`, { replace: true });
    }
  }, [authLoading, isAuthenticated, slug, quantity, navigate, showToast]);

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
    if (!isAuthenticated) {
      const redirectTarget = `/booking?event=${encodeURIComponent(slug)}&quantity=${quantity}`;
      navigate(`/user?redirect=${encodeURIComponent(redirectTarget)}`);
      return;
    }

    setProcessing(true);

    const bookingPayload = {
      event_id: Number(event.id) || null,
      event_slug: slug,
      title: event.title || 'Event Booking',
      location: event.location || event.venue || 'Hinjawadi, Pune',
      time: event.time || 'TBA',
      price: unitPrice,
      quantity,
      guest_name: user?.name || '',
      guest_email: user?.email || '',
      guest_phone: user?.phone || '',
      name: user?.name || '',
      email: user?.email || '',
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
      setProcessing(true);
      const isLoaded = await loadRazorpay();
      if (!isLoaded || !window.Razorpay) {
        showToast('Payment system could not be loaded. Please check your internet connection.');
        setProcessing(false);
        return;
      }

      const orderData = await apiRequest('/api/payment/create-order', {
        method: 'POST',
        body: JSON.stringify(bookingPayload),
      });

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'MAXSHOW Events',
        description: `${quantity}x ${event.title}`,
        image: '/logo.png',
        order_id: orderData.order_id,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
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

  if (authLoading || (!isAuthenticated && !confirmedBooking)) {
    return (
      <div className="min-h-screen bg-cream text-ink dark:bg-[#101820] dark:text-white flex flex-col justify-between">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <span className="h-8 w-8 inline-block rounded-full border-4 border-coral border-t-transparent animate-spin"></span>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              Redirecting to sign in...
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

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
            {/* Left: Attendee Details */}
            <div className="space-y-6">
              <div className="rounded-[2.5rem] bg-white p-6 sm:p-8 shadow-soft dark:bg-[#1c2733] border border-stone-200/80 dark:border-slate-700 space-y-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-coral">Attendee Information</p>
                  <h2 className="mt-1 text-2xl font-black text-ink dark:text-white">Ticket Holder</h2>
                </div>

                <div className="flex items-center gap-4 rounded-2xl bg-stone-50 p-4 dark:bg-[#151f2b] border border-stone-200 dark:border-slate-700 shadow-sm">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-coral text-base font-black text-white shadow-sm">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h4 className="font-bold text-ink dark:text-white text-base">{user?.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {user?.email} {user?.phone ? `· +91 ${user?.phone}` : ''}
                    </p>
                    <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      ✓ Verified Account Holder
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Order Summary Card */}
            <div className="space-y-6">
              <div className="rounded-[2.5rem] bg-white p-6 sm:p-8 shadow-soft dark:bg-[#1c2733] border border-stone-200/80 dark:border-slate-700 space-y-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-coral">Order Summary</p>
                  <h3 className="mt-1 text-xl sm:text-2xl font-black text-ink dark:text-white">{event.title}</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    📍 {event.venue || event.location} · 🕒 {timeFormatted}
                  </p>
                </div>

                <div className="divide-y divide-stone-100 dark:divide-slate-700 text-xs sm:text-sm">
                  <div className="flex justify-between py-2.5">
                    <span className="text-slate-500 dark:text-slate-400">Ticket Quantity</span>
                    <span className="font-bold text-ink dark:text-white">{quantity}x pass{quantity > 1 ? 'es' : ''}</span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-slate-500 dark:text-slate-400">Price per ticket</span>
                    <span className="font-bold text-ink dark:text-white">{formatPrice(unitPrice)}</span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-slate-500 dark:text-slate-400">Booking Fee</span>
                    <span className="font-bold text-emerald-600">₹0 (Waived)</span>
                  </div>
                  <div className="flex justify-between pt-4 text-base font-black text-ink dark:text-white">
                    <span>Total</span>
                    <span className="text-coral">{isFree ? 'Free entry' : formatPrice(totalPrice)}</span>
                  </div>
                </div>

                <button
                  disabled={processing}
                  onClick={handleConfirmBooking}
                  className="w-full rounded-2xl bg-coral py-4 text-sm sm:text-base font-bold text-white shadow-lg shadow-coral/25 hover:bg-[#df503c] transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  {processing ? (
                    'Processing booking...'
                  ) : isFree ? (
                    'Claim Free Pass →'
                  ) : (
                    `Pay ${formatPrice(totalPrice)} with Razorpay →`
                  )}
                </button>

                <p className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                  <span>🔒</span>
                  <span>Verified &amp; Secured with 256-bit SSL encryption.</span>
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
